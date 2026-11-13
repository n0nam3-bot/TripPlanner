"use client";

import { useState } from "react";
import { ArrowRight, Copy, LoaderCircle } from "lucide-react";
import type { SavedTripSnapshot } from "@/lib/trip-planner/saved-trips";

type Props = { sourceShareToken: string; searchQuery: string; snapshot: SavedTripSnapshot };
type StoredCredentials = { shareToken?: unknown; ownerToken?: unknown };
type PendingCopySession = { copyId?: unknown; returnPath?: unknown };

const OWNER_PREFIX = "tripfinder:saved-trip-owner:v1:";
const RESTORE_PREFIX = "tripfinder:saved-trip-fork-restore:v1:";
const SOURCE_SESSION_PREFIX = "tripfinder:pending-shared-copy:v1:";

function safePath(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("/results?") && !value.startsWith("//") ? value : null;
}

export function MakeTripCopyButton({ sourceShareToken, searchQuery, snapshot }: Props) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function clearPreviousCopy(): Promise<number> {
    let released = 0;
    try {
      const sourceSessionKey = `${SOURCE_SESSION_PREFIX}${sourceShareToken}`;
      const previous = JSON.parse(window.localStorage.getItem(sourceSessionKey) || "null") as PendingCopySession | null;
      const previousPath = safePath(previous?.returnPath);
      if (previousPath) window.localStorage.removeItem(`${RESTORE_PREFIX}${previousPath}`);

      // Older versions created a permanent saved-trip row immediately. Try
      // each browser-held owner credential; the server deletes only an exact,
      // unchanged fork of this source share, never a trip the traveler saved.
      const ownerKeys: string[] = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith(OWNER_PREFIX)) ownerKeys.push(key);
      }
      const seen = new Set<string>();
      for (const key of ownerKeys.slice(0, 12)) {
        let credentials: StoredCredentials | null = null;
        try { credentials = JSON.parse(window.localStorage.getItem(key) || "null") as StoredCredentials | null; } catch { continue; }
        if (typeof credentials?.shareToken !== "string" || typeof credentials.ownerToken !== "string") continue;
        const pair = `${credentials.shareToken}:${credentials.ownerToken}`;
        if (seen.has(pair)) continue;
        seen.add(pair);
        try {
          const response = await fetch("/api/trips/fork/discard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceShareToken, shareToken: credentials.shareToken, ownerToken: credentials.ownerToken }),
          });
          const data = await response.json().catch(() => ({})) as { deleted?: boolean };
          if (response.ok && data.deleted) {
            released += 1;
            // Remove every path entry that carries this exact credential pair.
            for (const ownerKey of ownerKeys) {
              try {
                const stored = JSON.parse(window.localStorage.getItem(ownerKey) || "null") as StoredCredentials | null;
                if (stored?.shareToken === credentials.shareToken && stored.ownerToken === credentials.ownerToken) window.localStorage.removeItem(ownerKey);
              } catch { /* Ignore malformed browser state. */ }
            }
          }
        } catch { /* Cleanup is best-effort; the new local draft remains available. */ }
      }
      window.localStorage.removeItem(sourceSessionKey);
    } catch { /* A browser without storage will be handled by the main copy flow. */ }
    return released;
  }

  async function makeCopy() {
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      const released = await clearPreviousCopy();
      const copyId = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      const params = new URLSearchParams(searchQuery);
      params.delete("copyId");
      params.set("copyId", copyId);
      const returnPath = `/results?${params.toString()}`;
      const restoreStorageKey = `${RESTORE_PREFIX}${returnPath}`;
      const sourceSessionKey = `${SOURCE_SESSION_PREFIX}${sourceShareToken}`;
      const sessionKey = `tripfinder:pending-shared-copy-session:v1:${copyId}`;

      window.localStorage.setItem(restoreStorageKey, JSON.stringify({ snapshot, releasedPreviousCopy: released > 0 }));
      window.localStorage.setItem(sessionKey, JSON.stringify({ copyId, returnPath, sourceSessionKey }));
      window.localStorage.setItem(sourceSessionKey, JSON.stringify({ copyId, returnPath }));
      window.location.assign(returnPath);
    } catch {
      setMessage("Your browser blocked local storage, so Tripfinder could not prepare the editable copy. Enable site storage and try again. No saved-trip slot was used.");
    } finally {
      setPending(false);
    }
  }

  return <div className="saved-trip-copy-control">
    <button type="button" className="button button-dark saved-trip-copy-button" onClick={() => void makeCopy()} disabled={pending}>
      {pending ? <LoaderCircle size={16} className="spin"/> : <Copy size={16}/>}
      {pending ? "Preparing your copy…" : "Make my own copy"}
      {!pending && <ArrowRight size={15}/>}
    </button>
    <small className="saved-trip-copy-note">Opens an editable draft. It only uses a daily saved-trip slot when you press Save trip.</small>
    {message && <p className="saved-trip-copy-message" role="status">{message}</p>}
  </div>;
}
