"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { LoaderCircle, MessageCircle, Minus, Send, Sparkles, X } from "lucide-react";
import type { TripAssistantContext, TripAssistantMessage } from "@/lib/ai/trip-assistant";

type Props = {
  context: TripAssistantContext;
  configured: boolean;
  databaseAvailable: boolean;
  geminiAvailable: boolean;
  openRouterAvailable: boolean;
};
type ChatMessage = TripAssistantMessage & { id: string; provider?: string; cached?: boolean; welcome?: boolean };

const quickQuestions = [
  "Which stay best matches my must-have features?",
  "Which stays are explicitly beachfront?",
  "Which properties are closest to a beach by walking distance?",
  "Compare the flight options by price and timing.",
  "Review my selected activities and dining schedule.",
];

const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  welcome: true,
  content: "I can help compare the travel options and trip details shown in Tripfinder. Ask about flights, stays, amenities, activities, dining, destination details, budget, or your selected schedule. I can’t help with unrelated topics.",
};

function messageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AITripAssistant({ context, configured, databaseAvailable, geminiAvailable, openRouterAvailable }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [draft, setDraft] = useState("");
  const [allowGemini, setAllowGemini] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasConversation = messages.length > 1;

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  async function ask(rawQuestion: string) {
    const question = rawQuestion.trim();
    if (!question || loading || question.length < 4) return;
    const history: TripAssistantMessage[] = messages
      .filter((message) => !message.welcome)
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { id: messageId(), role: "user", content: question }]);
    setDraft("");
    setLoading(true);
    try {
      const response = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history, context, allowGemini }),
      });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Tripfinder could not complete that travel question.");
      if (typeof payload.answer !== "string" || !payload.answer.trim()) throw new Error("The assistant returned an empty response. Try asking in a different way.");
      setMessages((current) => [...current, {
        id: messageId(), role: "assistant", content: payload.answer as string,
        provider: typeof payload.provider === "string" ? payload.provider : undefined,
        cached: payload.cached === true,
      }]);
    } catch (caught) {
      setMessages((current) => [...current, {
        id: messageId(), role: "assistant",
        content: caught instanceof Error ? caught.message : "Tripfinder could not reach an AI provider. Your travel results are unchanged.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await ask(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask(draft);
    }
  }

  return <div className="trip-ai-dock">
    {open && <section className="trip-ai-panel" role="dialog" aria-label="Tripfinder travel assistant" aria-modal="false">
      <header className="trip-ai-chat-header">
        <span className="trip-ai-chat-mark"><Sparkles size={17}/></span>
        <div><strong>Tripfinder assistant</strong><small>{context.destination} · Travel questions only</small></div>
        <button type="button" className="trip-ai-window-control" onClick={() => setOpen(false)} aria-label="Minimize Tripfinder assistant"><Minus size={18}/></button>
      </header>

      <div className="trip-ai-chat-messages" ref={scrollRef} aria-live="polite">
        {messages.map((message) => <div className={`trip-ai-chat-row ${message.role === "user" ? "is-user" : "is-assistant"}`} key={message.id}>
          <div className="trip-ai-chat-bubble">
            <p>{message.content}</p>
            {message.provider && <small>{message.provider}{message.cached ? " · saved answer" : message.provider === "Tripfinder local check" ? " · based on loaded result fields" : " · AI-assisted"}</small>}
          </div>
        </div>)}
        {loading && <div className="trip-ai-chat-row is-assistant"><div className="trip-ai-chat-bubble is-thinking"><LoaderCircle size={14} className="spin"/> Checking your trip details…</div></div>}
        {!hasConversation && <div className="trip-ai-chat-suggestions">{quickQuestions.map((prompt) => <button type="button" key={prompt} onClick={() => void ask(prompt)} disabled={loading}>{prompt}</button>)}</div>}
      </div>

      {!configured && <div className="trip-ai-chat-setup">
        {!openRouterAvailable && !geminiAvailable ? <>AI assistance is not connected. Add <code>OPENROUTER_API_KEY</code> and/or <code>GEMINI_API_KEY</code> in Vercel.</> : !databaseAvailable ? <>AI assistance needs the Neon usage limiter. Check <code>DATABASE_URL</code>.</> : "AI assistance is unavailable."}
      </div>}

      {geminiAvailable && <details className="trip-ai-consent-details">
        <summary>Gemini fallback consent <span>{allowGemini ? "On" : "Off · optional"}</span></summary>
        <label><input type="checkbox" checked={allowGemini} onChange={(event) => setAllowGemini(event.target.checked)} disabled={loading}/><span>Allow Gemini free-tier fallback. Google receives your question and a limited trip snapshot and may use free-tier prompts and responses to improve its products; human reviewers may process them. Keep this off unless you accept these terms. Do not include sensitive personal details.</span></label>
      </details>}
      <form className="trip-ai-chat-composer" onSubmit={submit}>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} maxLength={1000} rows={2} placeholder="Ask about your flights, stays or trip…" aria-label="Ask a Tripfinder travel question" disabled={loading}/>
        <button type="submit" disabled={loading || draft.trim().length < 4} aria-label="Send travel question">{loading ? <LoaderCircle size={17} className="spin"/> : <Send size={17}/>}</button>
      </form>
      <footer className="trip-ai-chat-footer">Answers use the results already loaded. No additional travel-provider searches are triggered.</footer>
    </section>}

    <button type="button" className={`trip-ai-launcher ${open ? "is-open" : ""}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Close Tripfinder assistant" : "Open Tripfinder assistant"}>
      {open ? <X size={19}/> : <><MessageCircle size={19}/><span>Ask Tripfinder</span></>}
    </button>
  </div>;
}
