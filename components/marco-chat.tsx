"use client";

import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { Card } from "@/components/ui";

export function MarcoChat() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setAnswer("");
    const response = await fetch("/api/marco", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    const payload = await response.json();
    setAnswer(payload.answer ?? payload.error ?? "Marco could not answer that yet.");
    setBusy(false);
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Bot size={20} />
        <h2 className="font-display text-2xl font-bold">Ask Marco</h2>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2"
          placeholder="Ask about conflicts, missing details, or next steps"
        />
        <button className="grid h-11 w-11 place-items-center rounded-lg bg-ink text-white" disabled={busy} aria-label="Send question">
          <Send size={17} />
        </button>
      </form>
      {answer && <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">{answer}</div>}
    </Card>
  );
}
