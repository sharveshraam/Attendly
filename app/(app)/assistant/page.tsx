"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Info, RotateCcw, Send, Sparkles, User } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { answerQuestion, QUICK_QUESTIONS, type AssistantData } from "@/lib/assistant";

interface Message { id: string; role: "user" | "assistant"; text: string; href?: string; label?: string }

export default function AssistantPage() {
  const { semester, courses, sessions, events, stats, assignments } = useWorkspace();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi! I answer questions using only the data already loaded in your workspace and Attendly's deterministic attendance engine. I never invent a percentage, and I never see another student's private records. Try a suggested question below.",
    },
  ]);

  const data = useMemo<AssistantData>(
    () => ({ semester, courses, sessions, events, stats, assignments }),
    [semester, courses, sessions, events, stats, assignments],
  );

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    const answer = answerQuestion(trimmed, data);
    setMessages((current) => [
      ...current,
      { id: `u-${Date.now()}`, role: "user", text: trimmed },
      { id: `a-${Date.now()}`, role: "assistant", text: answer.text, href: answer.action?.href, label: answer.action?.label },
    ]);
    setInput("");
  }

  return (
    <>
      <PageHeader
        eyebrow="On-device assistant"
        title="AI Assistant"
        subtitle="Deterministic answers from your own data — no external AI service"
        actions={<button className="btn" onClick={() => setMessages([{ id: `welcome-${Date.now()}`, role: "assistant", text: "Conversation cleared. Ask me about attendance, risk, recovery, your next class or deadlines." }])}><RotateCcw size={14} /> Clear chat</button>}
      />

      <div className="alert alert-warning" style={{ marginBottom: 14 }}>
        <Info size={15} />
        <span style={{ fontSize: 11.5 }}>
          <strong>No AI backend is connected.</strong> The live Supabase project has zero Edge Functions, so this assistant runs entirely in your browser. It calls the same attendance engine as the dashboard, uses only RLS-filtered data from your account, and never sends your records to an external model. It does not modify data.
        </span>
      </div>

      <div className="dash-grid">
        <Panel eyebrow="Conversation" title="Ask Attendly" action={<span className="badge badge-accent"><Sparkles size={12} /> Deterministic</span>}>
          <div style={{ minHeight: 320, maxHeight: 460, overflowY: "auto", display: "grid", gap: 12, marginBottom: 14 }}>
            {messages.map((message) => (
              <div key={message.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: message.role === "user" ? "row-reverse" : "row" }}>
                <span className="avatar avatar-sm" style={{ background: message.role === "user" ? "var(--accent-soft)" : "var(--accent-2-soft)", color: message.role === "user" ? "var(--accent-ink)" : "var(--accent-2)" }}>
                  {message.role === "user" ? <User size={13} /> : <Bot size={13} />}
                </span>
                <div className="card-flat" style={{ maxWidth: "82%", whiteSpace: "pre-wrap", fontSize: 12.5, background: message.role === "user" ? "var(--accent-soft)" : "var(--surface-2)" }}>
                  {message.text}
                  {message.href && (
                    <div style={{ marginTop: 10 }}>
                      <Link className="btn btn-sm btn-soft" href={message.href}>{message.label ?? "Open"} <ArrowRight size={13} /></Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); ask(input); }} style={{ display: "flex", gap: 8 }}>
            <input className="input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="How is my attendance?" aria-label="Ask Attendly" />
            <button className="btn btn-primary" type="submit" disabled={!input.trim()}><Send size={15} /> Ask</button>
          </form>
        </Panel>

        <div className="stack">
          <Panel eyebrow="Suggestions" title="Try asking">
            <div className="stack" style={{ gap: 6 }}>
              {QUICK_QUESTIONS.map((question) => (
                <button className="btn btn-block btn-ghost" style={{ justifyContent: "flex-start", textAlign: "left", fontWeight: 500 }} key={question} onClick={() => ask(question)}>
                  <Sparkles size={13} style={{ color: "var(--accent)", flex: "none" }} /> {question}
                </button>
              ))}
            </div>
          </Panel>
          <Panel eyebrow="How it works" title="Guarantees">
            <div className="stack muted" style={{ gap: 8, fontSize: 11.5 }}>
              <div>• Attendance numbers come from the canonical engine, not a language model.</div>
              <div>• Group members&apos; attendance is never loaded into this page.</div>
              <div>• Calculations are explained in the attendance, bunk and recovery tools.</div>
              <div>• Consequential changes always require a separate confirmation step in the UI.</div>
              <div>• The whole app works without this assistant.</div>
            </div>
            {!semester && <EmptyState title="No semester yet" description="Set up your workspace for useful answers." />}
          </Panel>
        </div>
      </div>
    </>
  );
}
