"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, Send, Sparkles } from "lucide-react";
import type { TripAssistantContext } from "@/lib/ai/trip-assistant";

type Props = {
  context: TripAssistantContext;
  configured: boolean;
  databaseAvailable: boolean;
  geminiAvailable: boolean;
  openRouterAvailable: boolean;
};

type Reply = { answer: string; provider: string; model: string; cached: boolean };

const quickQuestions = [
  "Which stay best matches my must-have features?",
  "Compare the strongest accommodation options and their trade-offs.",
  "Compare the flight options by airline, timing and displayed price.",
  "Review my selected activities and dining schedule for conflicts or gaps.",
];

export function AITripAssistant({ context, configured, databaseAvailable, geminiAvailable, openRouterAvailable }: Props) {
  const [question, setQuestion] = useState(quickQuestions[0]);
  const [allowGemini, setAllowGemini] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || loading || question.trim().length < 4 || (!openRouterAvailable && !(geminiAvailable && allowGemini))) return;
    setLoading(true);
    setError("");
    setReply(null);
    try {
      const response = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context, allowGemini }),
      });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "The AI assistant could not complete this request.");
      if (typeof payload.answer !== "string") throw new Error("The AI assistant returned an empty response.");
      setReply({
        answer: payload.answer,
        provider: typeof payload.provider === "string" ? payload.provider : "AI provider",
        model: typeof payload.model === "string" ? payload.model : "",
        cached: payload.cached === true,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The AI assistant is unavailable right now.");
    } finally {
      setLoading(false);
    }
  }

  return <section className="trip-ai-assistant" aria-labelledby="trip-ai-heading">
    <div className="trip-ai-heading">
      <div><span className="eyebrow"><Sparkles size={12}/> TRIPFINDER AI</span><h4 id="trip-ai-heading">Make sense of these options</h4><p>Ask about the results already loaded for this destination. This assistant does not run another flight, hotel or activity search.</p></div>
      <span className="trip-ai-mark"><Sparkles size={18}/></span>
    </div>

    {!configured ? <p className="trip-ai-setup">{!openRouterAvailable && !geminiAvailable ? <>AI assistance is not connected. Add <code>OPENROUTER_API_KEY</code> and/or <code>GEMINI_API_KEY</code> in Vercel to enable it.</> : !databaseAvailable ? <>AI assistance requires the Neon database for shared caching and request limits. Check <code>DATABASE_URL</code>.</> : "AI assistance is unavailable."}</p> : <>
      <div className="trip-ai-quick-prompts" aria-label="Suggested questions">
        {quickQuestions.map((item) => <button key={item} type="button" onClick={() => setQuestion(item)} disabled={loading}>{item}</button>)}
      </div>
      <form className="trip-ai-form" onSubmit={submit}>
        <label htmlFor="trip-ai-question">Your question</label>
        <textarea id="trip-ai-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} rows={3} placeholder="Ask which property fits your needs, compare flights, or review your selected schedule…" disabled={loading}/>
        {geminiAvailable && <label className="trip-ai-consent"><input type="checkbox" checked={allowGemini} onChange={(event) => setAllowGemini(event.target.checked)} disabled={loading}/><span><strong>{openRouterAvailable ? "Allow Google Gemini free-tier fallback." : "Allow Google Gemini free-tier requests."}</strong> Gemini receives your question and a limited trip snapshot (destination, dates, traveler counts, budget, preferences and returned option summaries). Google may use free-tier prompts and responses to improve its products, and human reviewers may process them. Leave unchecked unless you accept this. Do not include sensitive personal details.</span></label>}
        <div className="trip-ai-form-footer"><p>{openRouterAvailable ? "OpenRouter is attempted first with data-collection denial and zero-data-retention routing." : "Gemini requests are only sent after your opt-in."} {geminiAvailable ? "Gemini is only used with your opt-in." : "Gemini is not configured."} AI responses are based on already-loaded results and do not trigger travel-provider searches.</p><button className="button button-dark" type="submit" disabled={loading || question.trim().length < 4 || (!openRouterAvailable && !(geminiAvailable && allowGemini))}>{loading ? <><LoaderCircle size={15} className="spin"/> Thinking…</> : <>Ask Tripfinder <Send size={14}/></>}</button></div>
      </form>
      {error && <p className="trip-ai-error" role="alert">{error}</p>}
      {reply && <div className="trip-ai-reply"><div className="trip-ai-reply-meta"><strong>{reply.provider}</strong><span>{reply.cached ? "Saved AI answer" : "AI-assisted analysis"}</span></div><div className="trip-ai-answer">{reply.answer}</div><p className="trip-ai-caution">Based only on the provider results supplied to the assistant. Verify availability, exact prices, amenities and booking terms with the seller.</p></div>}
    </>}
  </section>;
}
