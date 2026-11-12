# Tripfinder Assistant: Context & Beach Classification Fix

This is an incremental patch for the currently deployed Tripfinder floating travel assistant (v3) after the `local_parse` event-type fix.

## Files included

- `app/api/ai/assist/route.ts`
  - Passes the recent conversation into local fallback handling.
  - Records local answers with the existing `local_parse` event type.
  - Bumps the assistant cache namespace so old answers generated with the incomplete property snapshot are not reused.
- `lib/ai/trip-assistant.ts`
  - Recognizes follow-up phrasing such as “yes, but…” and “which ones?” in a recent travel conversation.
  - Adds beachfront / beach front terms to the travel-topic allowlist while keeping off-topic and prompt-override rejections in place.
  - Uses loaded listing descriptions, essential information, excluded amenities, nearby beach names and transport durations.
  - Distinguishes beachfront wording from direct beach access, generic beach access, and a measurable walk/drive away.
  - Treats a stated beach distance as stronger evidence than a marketing title containing “beachfront”.
  - Handles Spanish beach references such as playa / frente a la playa.
  - Answers closest-beach questions using distances rather than a beachfront label.
- `components/trips/results-workspace.tsx`
  - Supplies those property facts and nearby-place travel durations to the assistant without triggering another provider search.
- `components/trips/ai-trip-assistant.tsx`
  - Clarifies the Gemini fallback consent label and provides separate beachfront and closest-beach suggested questions.

## Install

Apply this ZIP on top of the current Tripfinder assistant deployment using the existing GitHub ZIP updater. It contains only the four changed project files with their original paths. Do not use it as a replacement for the entire repository.

No environment variable changes, provider key changes, or Neon migrations are required.

## Validation performed

- Strict TypeScript check of `lib/ai/trip-assistant.ts`: passed.
- 11 targeted tests: passed, including topic gating, contextual follow-ups, unrelated coding rejection, property description and nearby travel-time retention, beachfront-vs-distance classification, direct-access distinction, and closest-beach behavior.
- ZIP integrity check: passed.
- Full Next.js production build: not run in this environment.

The assistant answers these deterministic beach questions from the already-loaded Tripfinder result snapshot. Other open-ended questions may still require a working OpenRouter or consented Gemini endpoint.
