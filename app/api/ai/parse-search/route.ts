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
import { LAYOVER_COUNTRY_OPTIONS } from "@/lib/trip-planner/flight-routing";
import {
  extractSearchPreferenceJson,
  sanitizeSearchPreferenceDraft,
  parseDeterministicSearchPreferenceDraft,
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
  const stringFields = ["origin", "originAirportCode", "destination", "destinationAirportCode", "destinationArea", "depart", "return", "style", "budgetMode", "currency", "staySpaceType", "cabin", "stops"];
  for (const key of stringFields) {
    const value = safeText(raw[key], 120);
    if (value) result[key] = value;
  }
  const numberFields = ["adults", "rooms", "budget"];
  for (const key of numberFields) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
  }
  for (const key of ["components", "stayTypes", "stayMust", "stayPrefer", "preferredLayoverCountries", "avoidLayoverCountries"]) {
    if (Array.isArray(raw[key])) result[key] = raw[key].slice(0, 24).map((item) => safeText(item, 40)).filter(Boolean);
  }
  return result;
}

function errorMessage(code: string): string {
  if (code.includes("AI_CLIENT_DAILY_LIMIT")) return "You've reached today's Tripfinder AI preference-parsing limit. Your normal travel search is unaffected.";
  if (code.includes("AI_PROVIDER_DAILY_LIMIT")) return "The configured free AI allowance has been reached for today. Your existing search form is unchanged.";
  if (code.includes("AI_PROVIDER_MINUTE_LIMIT")) return "The AI service is receiving requests too quickly. Try again in a minute.";
  if (code.includes("OPENROUTER_MODEL_MUST_BE_FREE")) return "OpenRouter is not configured with a free model. Set OPENROUTER_MODEL to openrouter/free or a model ending in :free.";
  if (code.includes("OPENROUTER_HTTP_401") || code.includes("GEMINI_HTTP_401")) return "The AI provider rejected its API key. Check the corresponding Vercel environment variable and redeploy.";
  if (code.includes("OPENROUTER_HTTP_402") || code.includes("GEMINI_HTTP_402")) return "The AI provider did not accept this request under its current free allowance or account balance.";
  if (code.includes("OPENROUTER_HTTP_429") || code.includes("GEMINI_HTTP_429")) return "The AI provider is rate-limiting requests. Try again later; your travel search form has not changed.";
  if (code.includes("AI_SEARCH_PARSER_INVALID_JSON") || code.includes("AI_SEARCH_PARSER_EMPTY_DRAFT") || code.includes("OPENROUTER_EMPTY_RESPONSE")) return "The AI provider returned an unusable response. Tripfinder's local parser can still recognize common destinations and stay preferences; try naming the city or area and the features you want.";
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
    const localDraft = parseDeterministicSearchPreferenceDraft(description, todayLocal);
    const localDraftFields = Object.entries(localDraft).filter(([key, value]) => key !== "notes" && value !== undefined).length;
    const hasLocalDraft = localDraftFields > 0;
    const hasUnparsedComplexDetail = /\b(20\d{2}|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|nights?|days?|adults?|children|kids?|travelers?|travellers?|guests?|rooms?|bedrooms?|under|below|budget|between|per person|each|stop(?:s)?|economy|business class)\b|\$\s*\d/i.test(description);
    const requestedDates = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}|\b20\d{2}-\d{2}-\d{2}\b|\b\d{1,2}[/.]\d{1,2}\b/i.test(description);
    const requestedBudget = /\b(budget|under|below|up to|max(?:imum)?)\b|[$€£]\s*\d/i.test(description);
    const requestedPartySize = /\b(?:flights?|airfare|tickets?|booking|reservation|trip|travel)\s+for\s+\d{1,2}\b|\b(?:for|party of|group of)\s+\d{1,2}\s*(?=(?:adults?|people|persons|travelers?|travellers?|guests?)\b|(?:from|going|leaving|traveling|travelling)\b)|\b\d{1,2}\s*(?:adults?|people|persons|travelers?|travellers?|guests?)\b/i.test(description);
    const requestedCabin = /\b(premium\s*(?:economy|eco)|premium\s+coach|prem\s+eco|first class|business class|economy|coach)\b/i.test(description);
    const connectionCountryMentioned = LAYOVER_COUNTRY_OPTIONS.some((country) => new RegExp(`(^|[^a-z])${country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z])`, "i").test(description));
    const requestedConnectionConstraint = connectionCountryMentioned && /\b(avoid|avoiding|exclude|excluding|skip|prefer|preferred|connect through|connection through|layover in|stops? to|stop in|transit through)\b/i.test(description);
    const localFlightDetailsComplete = (!requestedDates || Boolean(localDraft.departureDate || localDraft.returnDate))
      && (!requestedBudget || localDraft.budget !== undefined)
      && (!requestedPartySize || localDraft.adults !== undefined)
      && (!requestedCabin || Boolean(localDraft.cabinClass))
      && (!requestedConnectionConstraint || Boolean(localDraft.preferredLayoverCountries?.length || localDraft.avoidLayoverCountries?.length));
    const isShortHighConfidenceRequest = Boolean(localDraft.destination && localDraft.components?.length)
      && description.length <= 400
      && (!hasUnparsedComplexDetail || localFlightDetailsComplete)
      && localFlightDetailsComplete;

    const sendLocalDraft = async (reason: "direct" | "fallback") => {
      await recordProviderEvent({ provider: "Tripfinder Smart Parser", category: "Search preference parser", eventType: reason === "direct" ? "local_parse" : "provider_fallback", outcome: "success", cacheStatus: "none" });
      return NextResponse.json({
        draft: localDraft,
        provider: "Tripfinder Smart Parser",
        model: "local-rules-v1",
        cached: false,
        fallback: reason === "fallback",
        note: reason === "direct"
          ? "Recognized locally; no AI provider request was needed. Review the fields before applying."
          : "AI providers were unavailable or returned an unusable response. These are the details Tripfinder could identify locally; review them carefully and add anything missing manually.",
      }, { headers: { "Cache-Control": "no-store" } });
    };

    // Common, high-confidence descriptions are parsed locally to avoid a fragile
    // dependency on free-model availability and to save AI requests.
    if (hasLocalDraft && isShortHighConfidenceRequest) return sendLocalDraft("direct");
    if (!hasOpenRouter && !(allowGemini && hasGemini)) {
      if (hasLocalDraft) return sendLocalDraft("fallback");
      const configMessage = allowGemini && !hasGemini && !hasOpenRouter
        ? "Gemini fallback is enabled in the form, but GEMINI_API_KEY is not configured in Vercel. Add the key or configure OPENROUTER_API_KEY."
        : "No AI provider is configured, and Tripfinder could not identify enough details locally. Configure OPENROUTER_API_KEY or enable Gemini after adding GEMINI_API_KEY.";
      return NextResponse.json({ error: configMessage }, { status: 503 });
    }

    const normalizedDescription = description.toLocaleLowerCase().replace(/\s+/g, " ").trim();
    const currentKey = JSON.stringify(current);
    const cacheBase = { kind: "tripfinder-search-preference-draft-v2", description: normalizedDescription, current: currentKey, todayLocal };
    const openRouterKey = providerCacheKey({ ...cacheBase, provider: "openrouter" });
    const geminiKey = providerCacheKey({ ...cacheBase, provider: "gemini-consented" });

    for (const key of [...(hasOpenRouter ? [openRouterKey] : []), ...(allowGemini && hasGemini ? [geminiKey] : [])]) {
      try {
        const cached = await getProviderCache(key);
        const draft = cached?.payload?.draft;
        if (draft && typeof draft === "object" && !Array.isArray(draft)) {
          await recordProviderEvent({ provider: "Tripfinder AI Cache", category: "Search preference parser", eventType: "cache_hit", outcome: "success", cacheStatus: "hit" });
          return NextResponse.json({ draft, provider: cached?.payload?.provider ?? "Cached AI", model: cached?.payload?.model ?? "cached", cached: true }, { headers: { "Cache-Control": "no-store" } });
        }
      } catch {
        // Cache failure must not prevent preference parsing from continuing.
      }
    }

    try {
      await reserveAIClientRequest(clientKey);
    } catch (error) {
      if (hasLocalDraft) return sendLocalDraft("fallback");
      throw error;
    }
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
        preferredLayoverCountries: Array.isArray(current.preferredLayoverCountries) ? current.preferredLayoverCountries as string[] : [],
        avoidedLayoverCountries: Array.isArray(current.avoidLayoverCountries) ? current.avoidLayoverCountries as string[] : [],
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
        // The local parser acts as a deterministic backstop for dates, IATA codes,
        // party size, cabin aliases and connection-country constraints. Merge it
        // over the model response so a partial AI answer cannot silently drop them.
        const draft: SearchPreferenceDraft = sanitizeSearchPreferenceDraft({ ...raw, ...localDraft }, todayLocal, description);
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

    if (hasLocalDraft) return sendLocalDraft("fallback");
    const onlyLimits = failures.length > 0 && failures.every((item) => item.includes("LIMIT"));
    return NextResponse.json({ error: errorMessage(failures[0] || "AI_PROVIDER_UNAVAILABLE") }, { status: onlyLimits ? 429 : 503, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "AI_SEARCH_PARSER_FAILED";
    return NextResponse.json({ error: errorMessage(code) }, { status: code.includes("LIMIT") ? 429 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
