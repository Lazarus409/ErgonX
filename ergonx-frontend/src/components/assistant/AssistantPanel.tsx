"use client";

import { MessageSquarePlus, SendHorizontal, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import Alert from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Overlay";
import { assistantApi, getApiErrorMessage } from "@/lib/api";
import type { AssistantConversation, AssistantMessage, AssistantStatus } from "@/lib/api/assistant";
import { cx } from "@/lib/cx";

const SUGGESTIONS = ["How much annual leave do I have left?", "What is waiting for my approval?", "What does our leave policy say about carrying days over?", "Who is on leave this week?"];

/** "Ask ErgonX": shown on every page once the organisation has turned the assistant on. */
export default function AssistantPanel() {
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    assistantApi.getStatus().then((value) => { if (active) setStatus(value); }).catch(() => { /* hidden when unavailable */ });
    return () => { active = false; };
  }, []);

  if (!status?.enabled) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[120] inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-elevation-3 transition hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />Ask ErgonX
      </button>
      {open && <Conversation status={status} onStatus={setStatus} onClose={() => setOpen(false)} />}
    </>
  );
}

function Conversation({ status, onStatus, onClose }: { status: AssistantStatus; onStatus: (value: AssistantStatus) => void; onClose: () => void }) {
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [current, setCurrent] = useState<AssistantConversation | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const refreshList = useCallback(() => { assistantApi.listConversations().then((page) => setConversations(page.results)).catch(() => undefined); }, []);
  useEffect(() => { refreshList(); }, [refreshList]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages, busy]);

  const openConversation = async (id: string) => {
    setError("");
    if (!id) { setCurrent(null); setMessages([]); return; }
    try { const loaded = await assistantApi.getConversation(id); setCurrent(loaded); setMessages(loaded.messages ?? []); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
  };

  const send = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    setBusy(true); setError(""); setText("");
    const pending: AssistantMessage = { id: `pending-${Date.now()}`, role: "user", text: trimmed, tools_used: [], created_at: new Date().toISOString() };
    setMessages((previous) => [...previous, pending]);
    try {
      if (current) {
        const answer = await assistantApi.ask(current.id, trimmed);
        setMessages((previous) => [...previous, answer]);
      } else {
        const started = await assistantApi.startConversation(trimmed);
        setCurrent(started);
        setMessages(started.messages ?? []);
        refreshList();
      }
      assistantApi.getStatus().then(onStatus).catch(() => undefined);
    } catch (caught) {
      setMessages((previous) => previous.filter((message) => message.id !== pending.id));
      setText(trimmed);
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!current) return;
    try { await assistantApi.deleteConversation(current.id); setCurrent(null); setMessages([]); refreshList(); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width="md"
      title="Ask ErgonX"
      footer={
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <Textarea
              rows={2}
              value={text}
              maxLength={4000}
              aria-label="Your question"
              placeholder={status.remaining_today > 0 ? "Ask about your leave, pay, approvals or policies" : "Daily limit reached"}
              disabled={busy || status.remaining_today === 0}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(text); } }}
            />
            <Button aria-label="Send" loading={busy} disabled={!text.trim() || status.remaining_today === 0} onClick={() => void send(text)}><SendHorizontal className="h-4 w-4" /></Button>
          </div>
          <p className="text-caption text-ink-muted">Reads only what you can see in ErgonX and cannot change anything. Check important figures on the page itself. {status.remaining_today} of {status.daily_limit} questions left today; chats are deleted after {status.retention_days} days.</p>
        </div>
      }
    >
      <div className="flex min-h-full flex-col gap-4">
        <div className="flex items-center gap-2">
          <Select aria-label="Previous chats" value={current?.id ?? ""} onChange={(event) => void openConversation(event.target.value)}>
            <option value="">New chat</option>
            {conversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.title || "Untitled chat"}</option>)}
          </Select>
          <Button variant="ghost" aria-label="New chat" onClick={() => void openConversation("")}><MessageSquarePlus className="h-4 w-4" /></Button>
          {current && <Button variant="ghost" aria-label="Delete this chat" onClick={() => void remove()}><Trash2 className="h-4 w-4" /></Button>}
        </div>
        {error && <Alert tone="danger" onDismiss={() => setError("")}>{error}</Alert>}
        {messages.length === 0 && !busy && (
          <div className="space-y-2">
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => void send(suggestion)} className="block w-full rounded-xl border border-line px-3 py-2 text-left text-support text-ink hover:bg-surface-hover">{suggestion}</button>
            ))}
          </div>
        )}
        <ol className="space-y-3">
          {messages.map((message) => (
            <li key={message.id} className={cx("max-w-[90%] rounded-2xl px-4 py-2.5 text-support", message.role === "user" ? "ml-auto bg-primary text-white" : "bg-surface-muted text-ink")}>
              <p className="whitespace-pre-wrap">{message.text}</p>
              {message.tools_used.length > 0 && <p className="mt-1 text-caption text-ink-muted">Checked {message.tools_used.join(", ")}</p>}
            </li>
          ))}
          {busy && <li className="w-fit animate-pulse rounded-2xl bg-surface-muted px-4 py-2.5 text-support text-ink-muted">Looking that up…</li>}
        </ol>
        <div ref={bottom} />
      </div>
    </Drawer>
  );
}
