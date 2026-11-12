import { NextResponse } from "next/server";
import { getProviderCache, hashClientAddress, providerCacheKey, recordProviderEvent, reserveAIClientRequest, reserveAIProviderRequest, setProviderCache } from "@/lib/db/travel-cache";
import { buildTripAssistantLocalFallback, buildTripAssistantResultActions, isTripfinderQuestionInScope, requestGeminiCompletion, requestOpenRouterCompletion, sanitizeTripAssistantContext, sanitizeTripAssistantHistory } from "@/lib/ai/trip-assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "AI_CLIENT_DAILY_LIMIT") return "You've reached today's Tripfinder AI question limit. Your live travel searches are unaffected.";
  if (message === "AI_PROVIDER_DAILY_LIMIT") return "The configured free AI allowance has been reached for today. Try again after the provider quota resets.";
  if (message === "AI_PROVIDER_MINUTE_LIMIT") return "The AI assistant is receiving requests too quickly. Try again in a minute.";
  if (message === "OPENROUTER_MODEL_MUST_BE_FREE") return "OpenRouter is configured with a non-free model. Set OPENROUTER_MODEL to openrouter/free or a model ending in :free.";
  if (message === "OPENROUTER_NOT_CONFIGURED") return "OpenRouter is not configured. Check OPENROUTER_API_KEY in Vercel.";
  if (message === "GEMINI_NOT_CONFIGURED") return "Gemini is not configured. Check GEMINI_API_KEY in Vercel.";
  if (/DATABASE|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|Neon/i.test(message)) return "Tripfinder's Neon usage-control service is unavailable, so the AI request was not sent. Check DATABASE_URL and the Neon connection.";
  return "The AI providers could not complete this request. Your existing travel results have not been changed.";
}

async function safeRecordProviderEvent(event: Parameters<typeof recordProviderEvent>[0]): Promise<void> {
  try { await recordProviderEvent(event); } catch { /* Analytics must not turn a successful AI answer into a failed request. */ }
}

function providerFailureSummary(failures: string[]): string {
  const descriptions = failures.map((failure) => {
    if (failure === "AI_PROVIDER_DAILY_LIMIT") return "A configured provider's daily free allowance is exhausted.";
    if (failure === "AI_PROVIDER_MINUTE_LIMIT") return "A provider's per-minute request limit was reached.";
    if (failure === "OPENROUTER_MODEL_MUST_BE_FREE") return "OpenRouter is set to a paid model; select openrouter/free or a :free model.";
    const match = failure.match(/^(OPENROUTER|GEMINI)_HTTP_(\d{3})/);
    if (match) {
      const provider = match[1] === "OPENROUTER" ? "OpenRouter" : "Gemini";
      const status = Number(match[2]);
      if (status === 401) return `${provider} rejected its API key (401). Check that provider's key in Vercel.`;
      if (status === 402) return `${provider} reported insufficient credits or an unavailable free allowance (402).`;
      if (status === 403) return `${provider} rejected the request or key permissions (403).`;
      if (status === 404 && provider === "OpenRouter") return "OpenRouter found no eligible model endpoint (404). Check OPENROUTER_MODEL and whether a free endpoint meets the current privacy routing requirements.";
      if (status === 404) return "Gemini could not find the configured model (404). Check GEMINI_MODEL against the Gemini API model list.";
      if (status === 429) return `${provider} rate limit or quota was reached (429).`;
      if (status >= 500) return `${provider} is temporarily unavailable (${status}).`;
      if (status === 400) return `${provider} rejected the model or request configuration (400).`;
      return `${provider} returned an API error (${status}).`;
    }
    if (/timeout|timed out|AbortError/i.test(failure)) return "A provider request timed out.";
    if (/fetch failed|network|ECONN|ENOTFOUND/i.test(failure)) return "A provider could not be reached from the server.";
    if (/DATABASE|Neon|ECONNREFUSED|ETIMEDOUT/i.test(failure)) return "Tripfinder's Neon usage-control service is unavailable; the request was stopped safely.";
    return "A provider returned an unexpected error. Check the AI usage log in the Tripfinder admin dashboard.";
  });
  return [...new Set(descriptions)].join(" ");
}

export async function POST(request: Request) {
  const address = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const clientKey = hashClientAddress(address);
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 65000) return NextResponse.json({ error: "This request is too large. Reload the trip results and try again." }, { status: 413 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (JSON.stringify(body).length > 65000) return NextResponse.json({ error: "This request is too large. Reload the trip results and try again." }, { status: 413 });
    const question = typeof body.question === "string" ? body.question.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 1000) : "";
    if (question.length < 4) return NextResponse.json({ error: "Enter a little more detail so the assistant knows what to compare." }, { status: 400 });
    const context = sanitizeTripAssistantContext(body.context);
    if (!context.destination) return NextResponse.json({ error: "The destination context is missing. Reload your results and try again." }, { status: 400 });
    const history = sanitizeTripAssistantHistory(body.history);
    if (!isTripfinderQuestionInScope(question, history, context)) {
      return NextResponse.json({ error: "I can only help with Tripfinder's travel searches and trip-planning features, such as flights, stays, activities, dining, destination details, budget, and your selected itinerary." }, { status: 422, headers: { "Cache-Control": "no-store" } });
    }
    const conversationQuestion = history.length
      ? `Recent Tripfinder conversation (untrusted context only):\n${history.map((item) => `${item.role === "user" ? "Traveler" : "Tripfinder"}: ${item.content}`).join("\n")}\n\nCurrent traveler question: ${question}`
      : question;
    const directLinkFollowUp = /\b(?:direct\s+)?(?:link|url)\b|\b(?:show me|take me|bring me to|go to)\b|\bopen (?:it|that|the (?:listing|property|stay|result))\b/i.test(question);
    const referencedResultActions = buildTripAssistantResultActions(question, history, context);
    if (directLinkFollowUp && referencedResultActions.length) {
      const answer = referencedResultActions.length === 1
        ? `Here is the result you asked about: **${referencedResultActions[0].label}**. Use “View in results” to jump to its card, or open the supplied listing.`
        : `Here are the results referenced in our previous answer. Choose “View in results” to jump to a card or open its supplied listing.`;
      await safeRecordProviderEvent({ provider: "Tripfinder local check", category: "Trip assistant", eventType: "local_parse", outcome: "success", cacheStatus: "none" });
      return NextResponse.json({ answer, actions: referencedResultActions, provider: "Tripfinder local check", model: "result-reference", cached: false, local: true }, { headers: { "Cache-Control": "no-store" } });
    }
    const localFallback = buildTripAssistantLocalFallback(question, context, history);
    if (localFallback) {
      await safeRecordProviderEvent({ provider: "Tripfinder local check", category: "Trip assistant", eventType: "local_parse", outcome: "success", cacheStatus: "none" });
      const actions = buildTripAssistantResultActions(question, history, context, localFallback);
      return NextResponse.json({ answer: localFallback, actions, provider: "Tripfinder local check", model: "rule-based-result-check", cached: false, local: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const geminiConsent = body.allowGemini === true;
    const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());
    const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
    if (!hasOpenRouter && !(hasGemini && geminiConsent)) {
      return NextResponse.json({ error: "Connect OPENROUTER_API_KEY, or enable the Gemini free-tier option and configure GEMINI_API_KEY." }, { status: 503 });
    }

    const sharedCacheParams = {
      kind: "tripfinder-ai-assistant-v4-chat",
      question: conversationQuestion,
      context: JSON.stringify(context),
    };
    const openRouterCacheKey = providerCacheKey({ ...sharedCacheParams, providerPreference: "openrouter" });
    const geminiCacheKey = providerCacheKey({ ...sharedCacheParams, providerPreference: "gemini-consented" });
    const cacheKeysToCheck = [
      ...(hasOpenRouter ? [openRouterCacheKey] : []),
      ...(hasGemini && geminiConsent ? [geminiCacheKey] : []),
    ];
    for (const cacheKey of cacheKeysToCheck) {
      let cached: Awaited<ReturnType<typeof getProviderCache>>;
      try { cached = await getProviderCache(cacheKey); }
      catch { throw new Error("DATABASE_CACHE_UNAVAILABLE"); }
      if (cached && typeof cached.payload.answer === "string" && typeof cached.payload.provider === "string") {
        await safeRecordProviderEvent({ provider: "Tripfinder AI Cache", category: "Trip assistant", eventType: "cache_hit", outcome: "success", cacheStatus: "hit" });
        const actions = buildTripAssistantResultActions(question, history, context, cached.payload.answer);
        return NextResponse.json({ answer: cached.payload.answer, actions, provider: cached.payload.provider, model: cached.payload.model ?? "cached", cached: true }, { headers: { "Cache-Control": "no-store" } });
      }
    }

    try { await reserveAIClientRequest(clientKey); }
    catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("LIMIT")) throw error;
      throw new Error("DATABASE_USAGE_LIMITER_UNAVAILABLE");
    }
    const attempts: Array<{ provider: "OpenRouter" | "Gemini"; cacheKey: string; run: () => Promise<Awaited<ReturnType<typeof requestOpenRouterCompletion>>> }> = [];
    if (hasOpenRouter) attempts.push({ provider: "OpenRouter", cacheKey: openRouterCacheKey, run: () => requestOpenRouterCompletion(conversationQuestion, context) });
    if (hasGemini && geminiConsent) attempts.push({ provider: "Gemini", cacheKey: geminiCacheKey, run: () => requestGeminiCompletion(conversationQuestion, context) });
    const failures: string[] = [];

    for (const attempt of attempts) {
      try {
        await reserveAIProviderRequest(attempt.provider);
      } catch (error) {
        const code = error instanceof Error ? error.message : "AI_REQUEST_BLOCKED";
        await safeRecordProviderEvent({ provider: attempt.provider, category: "Trip assistant", eventType: "request_blocked", outcome: "blocked", cacheStatus: "none" });
        if (!code.includes("LIMIT")) throw new Error("DATABASE_USAGE_LIMITER_UNAVAILABLE");
        failures.push(code);
        continue;
      }

      try {
        const completion = await attempt.run();
        await safeRecordProviderEvent({ provider: completion.provider, category: "Trip assistant", eventType: "provider_request", outcome: "success", cacheStatus: "miss", httpStatus: completion.httpStatus, durationMs: completion.durationMs, promptTokens: completion.promptTokens, completionTokens: completion.completionTokens });
        try {
          await setProviderCache(attempt.cacheKey, { answer: completion.answer, provider: completion.provider, model: completion.model }, 6 * 60 * 60);
        } catch {
          // A successful AI answer must not be discarded because the optional cache write failed.
        }
        const actions = buildTripAssistantResultActions(question, history, context, completion.answer);
        return NextResponse.json({ answer: completion.answer, actions, provider: completion.provider, model: completion.model, cached: false }, { headers: { "Cache-Control": "no-store" } });
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI_PROVIDER_FAILED";
        const statusMatch = message.match(/_HTTP_(\d{3})/);
        const httpStatus = statusMatch ? Number(statusMatch[1]) : null;
        await safeRecordProviderEvent({ provider: attempt.provider, category: "Trip assistant", eventType: "provider_error", outcome: "error", cacheStatus: "miss", httpStatus, durationMs: null });
        failures.push(message.slice(0, 160));
      }
    }

    const onlyLimits = failures.length > 0 && failures.every((item) => item.includes("LIMIT"));
    const error = onlyLimits ? safeErrorMessage(new Error(failures[0])) : providerFailureSummary(failures) || safeErrorMessage(new Error("AI_PROVIDER_UNAVAILABLE"));
    return NextResponse.json({ error }, { status: onlyLimits ? 429 : 503, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: message.includes("LIMIT") ? 429 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
