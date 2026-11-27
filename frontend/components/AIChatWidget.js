
"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  
async function sendMessage(event) {
  event?.preventDefault();

  const text = input.trim();
  if (!text || isLoading) return;

  const updatedMessages = [
    ...messages,
    { role: "user", content: text },
  ];

  setMessages(updatedMessages);
  setInput("");
  setError("");
  setIsLoading(true);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(apiUrl("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: updatedMessages }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || `Chat request failed (${response.status}).`);
    }

    if (typeof data.message !== "string" || !data.message.trim()) {
      throw new Error("The AI returned an empty response. Please try again.");
    }

    setMessages((current) => [
      ...current,
      { role: "assistant", content: data.message },
    ]);
  } catch (err) {
    const message =
      err.name === "AbortError"
        ? "Nexus Support took too long to respond. Please try again."
        : err instanceof Error
          ? err.message
          : "Unable to contact Nexus Support. Please try again.";

    setError(message);
  } finally {
    clearTimeout(timeoutId);
    setIsLoading(false);
    inputRef.current?.focus();
  }
}


  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      {isOpen && (
        <section
          role="dialog"
          aria-label="Nexus Support chat"
          className="mb-3 flex h-[min(520px,75vh)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-950 text-slate-100 shadow-2xl shadow-cyan-950/40"
        >
          <header className="flex items-center justify-between border-b border-cyan-400/20 bg-slate-900 px-4 py-3">
            <div>
              <h2 className="font-bold text-cyan-300">Nexus Support</h2>
              <p className="text-xs text-slate-400">
                AI-powered store assistance
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              ✕
            </button>
          </header>

          <div
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto p-4"
          >
            {messages.length === 0 && (
              <div className="rounded-xl border border-cyan-400/15 bg-slate-900 p-3 text-sm text-slate-300">
                Welcome to Nexus Gaming! Ask me about orders, payment
                instructions, game listings, or store support.
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={`${index}-${msg.role}`}
                className={`max-w-[90%] whitespace-pre-wrap break-words rounded-xl p-3 text-sm ${
                  msg.role === "user"
                    ? "ml-auto bg-cyan-400/15 text-cyan-100"
                    : "mr-auto bg-slate-800 text-slate-200"
                }`}
              >
                {msg.content}
              </div>
            ))}

            {isLoading && (
              <p className="text-sm text-cyan-300" role="status">
                Nexus Support is thinking…
              </p>
            )}

            {error && (
              <div className="rounded-lg border border-red-400/20 bg-red-950/40 p-3 text-sm text-red-200">
                {error}
                <button
                  type="button"
                  onClick={() => setError("")}
                  className="ml-2 underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={sendMessage}
            className="flex gap-2 border-t border-cyan-400/20 bg-slate-900 p-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={4000}
              placeholder="Ask Nexus Support…"
              aria-label="Type your message"
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Close Nexus Support" : "Open Nexus Support"}
        aria-expanded={isOpen}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-400 text-2xl text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:scale-105 hover:bg-cyan-300"
      >
        {isOpen ? "✕" : "🤖"}
      </button>
    </div>
  );
}
