"use client";

import { useEffect, useRef, useState } from "react";
import type { DisputeMessage } from "@/hooks/api";

// Shared chat panel used by both the player match page and the staff
// dispute panel. Pure UI: parent supplies the message list, loading flag,
// and the send handler. Polling is owned by the parent's react-query hook.

interface Props {
  messages: DisputeMessage[];
  isLoading?: boolean;
  // Which side of the conversation the *viewer* sits on.
  // Players are always 'self' (their own thread). Staff rendering a player
  // thread sets this to 'staff' so player messages appear left-aligned.
  viewerRole: "self" | "staff";
  onSend: (body: string) => Promise<unknown>;
  emptyHint?: string;
  disabled?: boolean;
}

export function DisputeChat({
  messages,
  isLoading,
  viewerRole,
  onSend,
  emptyHint,
  disabled,
}: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the latest message whenever the list grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setErr(null);
    setSending(true);
    try {
      await onSend(body);
      setDraft("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={scrollRef}
        className="card p-3 flex flex-col gap-2 overflow-y-auto"
        style={{ maxHeight: 360, minHeight: 200 }}
      >
        {isLoading && messages.length === 0 ? (
          <p className="text-white/45 text-xs text-center py-6">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-white/45 text-xs text-center py-6">
            {emptyHint ?? "No messages yet."}
          </p>
        ) : (
          messages.map((m) => {
            // "Mine" = the message was authored on the same side the viewer
            // is acting from. Player viewers see their own messages on the
            // right and staff replies on the left; staff viewers see staff
            // replies on the right and the team's messages on the left.
            const mine =
              (viewerRole === "self" && !m.sender_is_staff) ||
              (viewerRole === "staff" && m.sender_is_staff);
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    mine
                      ? "bg-neon-cyan/15 border border-neon-cyan/30 text-white"
                      : "bg-white/[0.04] border border-white/10 text-white/85"
                  }`}
                >
                  <div className="text-[0.6rem] uppercase tracking-[0.16em] text-white/50 mb-0.5">
                    {m.sender_is_staff ? "Staff" : "Team"}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div className="text-[0.6rem] text-white/40 mt-1 text-right">
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {err && <p className="text-red-400 text-xs">⚠ {err}</p>}

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Type a message…"
        rows={2}
        maxLength={2000}
        disabled={disabled || sending}
        className="input-neon w-full resize-none"
      />
      <button
        onClick={submit}
        disabled={disabled || sending || draft.trim().length === 0}
        className="btn-neon w-full"
      >
        {sending ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
