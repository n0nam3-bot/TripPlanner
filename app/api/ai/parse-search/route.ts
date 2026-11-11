import { NextResponse } from "next/server";
import {
  getProviderCache,
  hashClientAddress,
  providerCacheKey,
  recordProviderEvent,
  reserveAIClientRequest,
  reserveAIProviderRequest,
  setProviderCache,
} from "@/lib/db/travel-cache";
import {
  requestGeminiCompletion,
  requestOpenRouterCompletion,
  type TripAssistantContext,
} from "@/lib/ai/trip-assistant";
import {
  extractSearchPreferenceJson,
  sanitizeSearchPreferenceDraft,
  SEARCH_PREFERENCE_SYSTEM_PROMPT,
  type SearchPreferenceDraft,
} from "@/lib/ai/search-preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_OPTIONS = { systemPrompt: SEARCH_PREFERENCE_SYSTEM_PROMPT, maxTokens: 850, jsonMode: true } as const;

function safeText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function safeCurrent(value: unknown): Record<string, unknown> {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result: Record<string, unknown> = {};
  const stringFields = ["origin", "destination", "destinationArea", "depart", "return", "style", "budgetMode", "currency", "staySpaceType", "cabin", "stops"];
  for (const key of stringFields) {
    const value = safeText(raw[key], 120);
    if (value) result[key] = value;
  }
  const numberFields = ["adults", "rooms", "budget"];
  for (const key of numberFields) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
  }
  for (const key of ["components", "stayTypes", "stayMust", "stayPrefer"]) {
    if (Array.isArray(raw[key])) result[key] = raw[key].slice(0, 24).map((item) => safeText(item, 40)).filter(Boolean);
  }
  return result;
}

function errorMessage(code: string): string {
  if (code.includes("AI_CLIENT_DAILY_LIMIT")) return "You've reached today's Tripfinder AI preference-parsing limit. Your normal travel search is unaffected.";
  if (code.includes("AI_PROVIDER_DAILY_LIMIT")) return "The configured free AI allowance has been reached for today. Your existing search form is unchanged.";
  if (code.includes("AI_PROVIDER_MINUTE_LIMIT")) return "The AI service is receiving requests too quickly. Try again in a minute.";
  if (code.includes("OPENROUTER_MODEL_MUST_BE_FREE")) return "OpenRouter is not configured with a free model. Set OPENROUTER_MODEL to openrouter/free or a model ending in :free.";
  if (code.includes("DATABASE_NOT_CONFIGURED") || code.includes("DATABASE_UNAVAILABLE")) return "Preference parsing needs the Neon cache and usage limiter. Check DATABASE_URL.";
  return "Tripfinder couldn't interpret that description. Your current search selections have not been changed; try a shorter or more specific description.";
}

export async function POST(request: Request) {
  const address = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const clientKey = hashClientAddress(address);
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 12000) return NextResponse.json({ error: "Keep the trip description under 2,000 characters." }, { status: 413 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (JSON.stringify(body).length > 12000) return NextResponse.json({ error: "Keep the trip description under 2,000 characters." }, { status: 413 });
    const description = safeText(body.description, 2000);
    if (description.length < 8) return NextResponse.json({ error: "Describe the trip in a little more detail." }, { status: 400 });

    const todayRaw = safeText(body.todayLocal, 10);
    const todayLocal = /^\d{4}-\d{2}-\d{2}$/.test(todayRaw) ? todayRaw : new Date().toISOString().slice(0, 10);
    const current = safeCurrent(body.current);
    const allowGemini = body.allowGemini === true;
    const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());
    const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
    if (!hasOpenRouter && !(allowGemini && hasGemini)) {
      return NextResponse.json({ error: "Connect OPENROUTER_API_KEY, or enable the Gemini fallback and configure GEMINI_API_KEY." }, { status: 503 });
    }

    const normalizedDescription = description.toLocaleLowerCase().replace(/\s+/g, " ").trim();
    const currentKey = JSON.stringify(current);
    const cacheBase = { kind: "tripfinder-search-preference-draft-v1", description: normalizedDescription, current: currentKey, todayLocal };
    const openRouterKey = providerCacheKey({ ...cacheBase, provider: "openrouter" });
    const geminiKey = providerCacheKey({ ...cacheBase, provider: "gemini-consented" });

    for (const key of [...(hasOpenRouter ? [openRouterKey] : []), ...(allowGemini && hasGemini ? [geminiKey] : [])]) {
      const cached = await getProviderCache(key);
      const draft = cached?.payload?.draft;
      if (draft && typeof draft === "object" && !Array.isArray(draft)) {
        await recordProviderEvent({ provider: "Tripfinder AI Cache", category: "Search preference parser", eventType: "cache_hit", outcome: "success", cacheStatus: "hit" });
        return NextResponse.json({ draft, provider: cached?.payload?.provider ?? "Cached AI", model: cached?.payload?.model ?? "cached", cached: true }, { headers: { "Cache-Control": "no-store" } });
      }
    }

    await reserveAIClientRequest(clientKey);
    const context: TripAssistantContext = {
      destination: safeText(current.destination, 120) || "Not selected",
      currency: safeText(current.currency, 3) || "USD",
      budget: typeof current.budget === "number" ? current.budget : undefined,
      departureDate: safeText(current.depart, 10) || undefined,
      returnDate: safeText(current.return, 10) || undefined,
      adults: typeof current.adults === "number" ? current.adults : undefined,
      rooms: typeof current.rooms === "number" ? current.rooms : undefined,
      preferences: {
        tripStyle: safeText(current.style, 40) || undefined,
        mustHave: Array.isArray(current.stayMust) ? current.stayMust as string[] : [],
        prefer: Array.isArray(current.stayPrefer) ? current.stayPrefer as string[] : [],
      },
    };
    const question = [
      `Traveler's description: ${description}`,
      `Local current date: ${todayLocal}`,
      `Current form state (context only; do not echo fields unless the description changes them): ${JSON.stringify(current)}`,
      "Return a partial structured patch. Use null for every field the traveler did not request.",
    ].join("\n\n");

    const attempts: Array<{ provider: "OpenRouter" | "Gemini"; cacheKey: string; run: () => Promise<Awaited<ReturnType<typeof requestOpenRouterCompletion>>> }> = [];
    if (hasOpenRouter) attempts.push({ provider: "OpenRouter", cacheKey: openRouterKey, run: () => requestOpenRouterCompletion(question, context, { ...JSON_OPTIONS, jsonMode: false }) });
    if (allowGemini && hasGemini) attempts.push({ provider: "Gemini", cacheKey: geminiKey, run: () => requestGeminiCompletion(question, context, JSON_OPTIONS) });
    const failures: string[] = [];

    for (const attempt of attempts) {
      try {
        await reserveAIProviderRequest(attempt.provider);
      } catch (error) {
        const code = error instanceof Error ? error.message : "AI_REQUEST_BLOCKED";
        await recordProviderEvent({ provider: attempt.provider, category: "Search preference parser", eventType: "request_blocked", outcome: "blocked", cacheStatus: "none" });
        failures.push(code);
        continue;
      }

      try {
        const completion = await attempt.run();
        const raw = extractSearchPreferenceJson(completion.answer);
        if (!raw) throw new Error("AI_SEARCH_PARSER_INVALID_JSON");
        const draft: SearchPreferenceDraft = sanitizeSearchPreferenceDraft(raw, todayLocal, description);
        const usableFields = Object.entries(draft).filter(([key, value]) => key !== "notes" && value !== undefined).length;
        if (!usableFields) throw new Error("AI_SEARCH_PARSER_EMPTY_DRAFT");

        await recordProviderEvent({ provider: completion.provider, category: "Search preference parser", eventType: "provider_request", outcome: "success", cacheStatus: "miss", httpStatus: completion.httpStatus, durationMs: completion.durationMs, promptTokens: completion.promptTokens, completionTokens: completion.completionTokens });
        try {
          await setProviderCache(attempt.cacheKey, { draft, provider: completion.provider, model: completion.model }, 24 * 60 * 60);
        } catch {
          // A successful parse must not be discarded when the optional cache write fails.
        }
        return NextResponse.json({ draft, provider: completion.provider, model: completion.model, cached: false }, { headers: { "Cache-Control": "no-store" } });
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI_PROVIDER_FAILED";
        const match = message.match(/_HTTP_(\d{3})/);
        await recordProviderEvent({ provider: attempt.provider, category: "Search preference parser", eventType: "provider_error", outcome: "error", cacheStatus: "miss", httpStatus: match ? Number(match[1]) : null });
        failures.push(message.slice(0, 180));
      }
    }

    const onlyLimits = failures.length > 0 && failures.every((item) => item.includes("LIMIT"));
    return NextResponse.json({ error: errorMessage(failures[0] || "AI_PROVIDER_UNAVAILABLE") }, { status: onlyLimits ? 429 : 503, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "AI_SEARCH_PARSER_FAILED";
    return NextResponse.json({ error: errorMessage(code) }, { status: code.includes("LIMIT") ? 429 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
