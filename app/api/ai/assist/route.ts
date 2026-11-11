import { NextResponse } from "next/server";
import { getProviderCache, hashClientAddress, providerCacheKey, recordProviderEvent, reserveAIClientRequest, reserveAIProviderRequest, setProviderCache } from "@/lib/db/travel-cache";
import { requestGeminiCompletion, requestOpenRouterCompletion, sanitizeTripAssistantContext } from "@/lib/ai/trip-assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "AI_CLIENT_DAILY_LIMIT") return "You've reached today's Tripfinder AI question limit. Your live travel searches are unaffected.";
  if (message === "AI_PROVIDER_DAILY_LIMIT") return "The configured free AI allowance has been reached for today. Try again after the provider quota resets.";
  if (message === "AI_PROVIDER_MINUTE_LIMIT") return "The AI assistant is receiving requests too quickly. Try again in a minute.";
  if (message === "OPENROUTER_MODEL_MUST_BE_FREE") return "OpenRouter is configured with a non-free model. Set OPENROUTER_MODEL to openrouter/free or a model ending in :free.";
  if (message.includes("DATABASE_NOT_CONFIGURED") || message.includes("DATABASE_UNAVAILABLE")) return "The AI assistant needs the Neon cache and usage limiter. Check DATABASE_URL.";
  return "The AI providers are temporarily unavailable. Your existing travel results have not been changed.";
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
    const geminiConsent = body.allowGemini === true;
    const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());
    const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
    if (!hasOpenRouter && !(hasGemini && geminiConsent)) {
      return NextResponse.json({ error: "Connect OPENROUTER_API_KEY, or enable the Gemini free-tier option and configure GEMINI_API_KEY." }, { status: 503 });
    }

    const sharedCacheParams = {
      kind: "tripfinder-ai-assistant-v2",
      question,
      context: JSON.stringify(context),
    };
    const openRouterCacheKey = providerCacheKey({ ...sharedCacheParams, providerPreference: "openrouter" });
    const geminiCacheKey = providerCacheKey({ ...sharedCacheParams, providerPreference: "gemini-consented" });
    const cacheKeysToCheck = [
      ...(hasOpenRouter ? [openRouterCacheKey] : []),
      ...(hasGemini && geminiConsent ? [geminiCacheKey] : []),
    ];
    for (const cacheKey of cacheKeysToCheck) {
      const cached = await getProviderCache(cacheKey);
      if (cached && typeof cached.payload.answer === "string" && typeof cached.payload.provider === "string") {
        await recordProviderEvent({ provider: "Tripfinder AI Cache", category: "Trip assistant", eventType: "cache_hit", outcome: "success", cacheStatus: "hit" });
        return NextResponse.json({ answer: cached.payload.answer, provider: cached.payload.provider, model: cached.payload.model ?? "cached", cached: true }, { headers: { "Cache-Control": "no-store" } });
      }
    }

    await reserveAIClientRequest(clientKey);
    const attempts: Array<{ provider: "OpenRouter" | "Gemini"; cacheKey: string; run: () => Promise<Awaited<ReturnType<typeof requestOpenRouterCompletion>>> }> = [];
    if (hasOpenRouter) attempts.push({ provider: "OpenRouter", cacheKey: openRouterCacheKey, run: () => requestOpenRouterCompletion(question, context) });
    if (hasGemini && geminiConsent) attempts.push({ provider: "Gemini", cacheKey: geminiCacheKey, run: () => requestGeminiCompletion(question, context) });
    const failures: string[] = [];

    for (const attempt of attempts) {
      try {
        await reserveAIProviderRequest(attempt.provider);
      } catch (error) {
        const code = error instanceof Error ? error.message : "AI_REQUEST_BLOCKED";
        await recordProviderEvent({ provider: attempt.provider, category: "Trip assistant", eventType: "request_blocked", outcome: "blocked", cacheStatus: "none" });
        failures.push(code);
        continue;
      }

      try {
        const completion = await attempt.run();
        await recordProviderEvent({ provider: completion.provider, category: "Trip assistant", eventType: "provider_request", outcome: "success", cacheStatus: "miss", httpStatus: completion.httpStatus, durationMs: completion.durationMs, promptTokens: completion.promptTokens, completionTokens: completion.completionTokens });
        try {
          await setProviderCache(attempt.cacheKey, { answer: completion.answer, provider: completion.provider, model: completion.model }, 6 * 60 * 60);
        } catch {
          // A successful AI answer must not be discarded because the optional cache write failed.
        }
        return NextResponse.json({ answer: completion.answer, provider: completion.provider, model: completion.model, cached: false }, { headers: { "Cache-Control": "no-store" } });
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI_PROVIDER_FAILED";
        const statusMatch = message.match(/_HTTP_(\d{3})/);
        const httpStatus = statusMatch ? Number(statusMatch[1]) : null;
        await recordProviderEvent({ provider: attempt.provider, category: "Trip assistant", eventType: "provider_error", outcome: "error", cacheStatus: "miss", httpStatus, durationMs: null });
        failures.push(message.slice(0, 160));
      }
    }

    const onlyLimits = failures.length > 0 && failures.every((item) => item.includes("LIMIT"));
    const error = onlyLimits ? safeErrorMessage(new Error(failures[0])) : safeErrorMessage(new Error("AI_PROVIDER_UNAVAILABLE"));
    return NextResponse.json({ error }, { status: onlyLimits ? 429 : 503, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: message.includes("LIMIT") ? 429 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
