"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: string;
  senderId: string;
  senderName: string | null;
  content: string;
  timestamp: string | null;
  isRead: boolean;
}

export default function ClientMessagesPage() {
  const { fetchWithAuth } = useApiClient();
  const { identity } = useAuth();
  const clientId = identity?.clientId ?? null;
  const [conversation, setConversation] = useState<{ conversationId: string; coachName: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newContent, setNewContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [authError, setAuthError] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const [convRes, msgRes] = await Promise.all([
        fetchWithAuth("/api/client/conversation"),
        fetchWithAuth("/api/client/conversation/messages"),
      ]);
      if (convRes.status === 401 || msgRes.status === 401) {
        setAuthError(true);
        return;
      }
      if (convRes.ok) {
        const c = await convRes.json();
        setConversation(c.conversationId ? { conversationId: c.conversationId, coachName: c.coachName ?? "Coach" } : null);
      }
      if (msgRes.ok) {
        const list = await msgRes.json();
        setMessages(Array.isArray(list) ? list : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newContent.trim()) return;
    setSending(true);
    try {
      const res = await fetchWithAuth("/api/client/conversation/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent.trim() }),
      });
      if (res.ok) {
        setNewContent("");
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: data.id,
            senderId: clientId ?? "",
            senderName: null,
            content: newContent.trim(),
            timestamp: data.timestamp ?? null,
            isRead: false,
          },
        ]);
      }
    } finally {
      setSending(false);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/client" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Messages</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Chat with your coach.
        </p>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}
      {!loading && !conversation && (
        <Card className="p-6">
          <p className="text-[var(--color-text-muted)]">You don’t have a coach assigned yet, or messaging isn’t set up.</p>
        </Card>
      )}
      {!loading && conversation && (
        <Card className="flex flex-col p-0 min-h-[360px]">
          <div className="border-b border-[var(--color-border)] px-4 py-3 font-medium text-[var(--color-text)]">
            {conversation.coachName}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">No messages yet. Say hello!</p>}
            {messages.map((m) => {
              const isClient = m.senderId === clientId;
              return (
                <div
                  key={m.id}
                  className={`rounded-lg px-3 py-2 max-w-[85%] ${isClient ? "ml-auto mr-0 bg-[var(--color-primary-subtle)]" : "ml-0 mr-auto bg-[var(--color-bg-elevated)]"}`}
                >
                  <p className="text-xs font-medium text-[var(--color-text-muted)]">{isClient ? "You" : (m.senderName || "Coach")}</p>
                  <p className="text-sm text-[var(--color-text)]">{m.content}</p>
                  {m.timestamp && <p className="text-xs text-[var(--color-text-muted)] mt-1">{new Date(m.timestamp).toLocaleString()}</p>}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-[var(--color-border)] p-3 flex gap-2">
            <input
              type="text"
              placeholder="Type a message…"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
            />
            <Button onClick={sendMessage} disabled={!newContent.trim() || sending}>
              {sending ? "…" : "Send"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
