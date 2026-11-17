/**
 * Extract the first safe HTTPS photo URL from common SerpApi image shapes.
 * Google Maps local results can expose `images` as an array of URL strings,
 * as well as thumbnail / thumbnail_large / serpapi_thumbnail fields. Google
 * Hotels exposes `images` as objects with thumbnail and original_image URLs.
 */
const IMAGE_URL_KEYS = [
  "original_image",
  "image",
  "thumbnail_large",
  "thumbnail",
  "serpapi_thumbnail",
  "url",
  "src",
] as const;

function safeImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return undefined;
    if (url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function visit(value: unknown, depth: number): string | undefined {
  if (depth > 4 || value == null) return undefined;

  const direct = safeImageUrl(value);
  if (direct) return direct;

  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = visit(entry, depth + 1);
      if (candidate) return candidate;
    }
    return undefined;
  }

  if (typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of IMAGE_URL_KEYS) {
    const candidate = visit(record[key], depth + 1);
    if (candidate) return candidate;
  }
  return undefined;
}

export function firstProviderImage(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    const image = visit(candidate, 0);
    if (image) return image;
  }
  return undefined;
}
