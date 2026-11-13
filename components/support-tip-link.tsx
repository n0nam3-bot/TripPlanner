import { ArrowUpRight, Heart } from "lucide-react";

const DEFAULT_SUPPORT_TIP_URL = "https://streamlabs.com/artofreyes/tip";

function getSupportTipUrl(): string {
  const configuredUrl = process.env.SUPPORT_TIP_URL?.trim();
  if (!configuredUrl) return DEFAULT_SUPPORT_TIP_URL;

  try {
    const parsed = new URL(configuredUrl);
    // Only allow secure external destinations. Invalid configuration safely falls
    // back to the Streamlabs page supplied for Tripfinder.
    if (parsed.protocol !== "https:" || !parsed.hostname) return DEFAULT_SUPPORT_TIP_URL;
    return parsed.toString();
  } catch {
    return DEFAULT_SUPPORT_TIP_URL;
  }
}

export function SupportTipLink({ compact = false }: { compact?: boolean }) {
  const url = getSupportTipUrl();

  if (compact) {
    return (
      <a
        className="support-project-link support-project-link-compact"
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        aria-label="Support Tripfinder with an optional tip (opens in a new tab)"
        title="Support Tripfinder"
      >
        <Heart size={14} aria-hidden="true" />
        <span>Support</span>
        <ArrowUpRight size={13} aria-hidden="true" />
      </a>
    );
  }

  return (
    <div className="support-project">
      <div className="support-project-copy">
        <strong>Enjoying Tripfinder?</strong>
        <span>Optional tips help support independent development.</span>
        <small>Checkout handled by Streamlabs.</small>
      </div>
      <a
        className="support-project-link"
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        aria-label="Support Tripfinder with an optional tip (opens in a new tab)"
      >
        <Heart size={14} aria-hidden="true" />
        <span>Support Tripfinder</span>
        <ArrowUpRight size={13} aria-hidden="true" />
      </a>
    </div>
  );
}
