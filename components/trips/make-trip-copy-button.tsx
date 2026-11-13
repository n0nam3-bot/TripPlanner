"use client";

import { useState } from "react";
import { ArrowRight, Copy, LoaderCircle } from "lucide-react";
import type { SavedTripSnapshot } from "@/lib/trip-planner/saved-trips";

type Props = { sourceShareToken: string; searchQuery: string; snapshot: SavedTripSnapshot };

type ForkResponse = { error?: string; shareToken?: string; ownerToken?: string; shareUrl?: string };

export function MakeTripCopyButton({ sourceShareToken, searchQuery, snapshot }: Props) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [fallbackShareUrl, setFallbackShareUrl] = useState("");

  async function makeCopy() {
    if (pending) return;
    setPending(true);
    setMessage("");
    setFallbackShareUrl("");
    try {
      const response = await fetch("/api/trips/fork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceShareToken }),
      });
      const data = await response.json().catch(() => ({})) as ForkResponse;
      if (!response.ok || !data.shareToken || !data.ownerToken || !data.shareUrl) {
        throw new Error(data.error || "Tripfinder couldn't create your copy right now.");
      }

      const returnPath = `/results?${searchQuery}`;
      const ownerStorageKey = `tripfinder:saved-trip-owner:v1:${returnPath}`;
      const restoreStorageKey = `tripfinder:saved-trip-fork-restore:v1:${returnPath}`;
      try {
        window.localStorage.setItem(ownerStorageKey, JSON.stringify({ shareToken: data.shareToken, ownerToken: data.ownerToken }));
        window.localStorage.setItem(restoreStorageKey, JSON.stringify({ snapshot }));
      } catch {
        setFallbackShareUrl(data.shareUrl);
        setMessage("Your copy was created, but this browser blocked local storage, so Tripfinder could not keep the edit permission on this device.");
        return;
      }
      window.location.assign(returnPath);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tripfinder couldn't create your copy right now.");
    } finally {
      setPending(false);
    }
  }

  return <div className="saved-trip-copy-control">
    <button type="button" className="button button-dark saved-trip-copy-button" onClick={() => void makeCopy()} disabled={pending}>
      {pending ? <LoaderCircle size={16} className="spin"/> : <Copy size={16}/>}
      {pending ? "Creating your copy…" : "Make my own copy"}
      {!pending && <ArrowRight size={15}/>}
    </button>
    {message && <p className="saved-trip-copy-message" role="status">{message}{fallbackShareUrl && <> <a href={fallbackShareUrl}>Open your copy</a></>}</p>}
  </div>;
}
