"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateTimeDisplay } from "@/lib/format-date";
import { useAuth } from "@/contexts/AuthContext";

interface Conversation {
  conversationId: string;
  clientId: string;
  clientName: string;
  lastMessage: { content: string; timestamp: string; senderId: string };
}

interface Message {
  id: string;
  senderId: string;
  senderName: string | null;
  content: string;
  timestamp: string | null;
  isRead: boolean;
}

export default function CoachMessagesPage() {
  const { fetchWithAuth } = useApiClient();
  const { identity } = useAuth();
  const coachId = identity?.coachId ?? null;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [clientName, setClientName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [authError, setAuthError] = useState(false);

  const loadConversations = async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const res = await fetchWithAuth("/api/coach/conversations");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setConversations(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [fetchWithAuth]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      setClientName("");
      return;
    }
    const conv = conversations.find((c) => c.conversationId === selected);
    if (conv) setClientName(conv.clientName);
    setLoadingThread(true);
    (async () => {
      try {
        const res = await fetchWithAuth(`/api/coach/conversations/${selected}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(Array.isArray(data) ? data : []);
        }
      } finally {
        setLoadingThread(false);
      }
    })();
  }, [selected, fetchWithAuth, conversations]);

  const sendMessage = async () => {
    if (!selected || !newContent.trim()) return;
    setSending(true);
    try {
      const res = await fetchWithAuth(`/api/coach/conversations/${selected}/messages`, {
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
            senderId: "",
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
    return <AuthErrorRetry onRetry={loadConversations} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Messages</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Chat with your clients. Select a conversation to view and send messages.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <Card className="overflow-hidden p-0">
          {loading && <p className="p-4 text-sm text-[var(--color-text-muted)]">Loading…</p>}
          {!loading && conversations.length === 0 && (
            <p className="p-4 text-sm text-[var(--color-text-muted)]">No conversations yet.</p>
          )}
          {!loading && conversations.length > 0 && (
            <ul className="divide-y divide-[var(--color-border)]">
              {conversations.map((c) => (
                <li key={c.conversationId}>
                  <button
                    type="button"
                    onClick={() => setSelected(c.conversationId)}
                    className={`flex min-h-[48px] w-full flex-col justify-center px-4 py-3 text-left hover:bg-[var(--color-primary-subtle)] touch-manipulation ${selected === c.conversationId ? "bg-[var(--color-primary-subtle)]" : ""}`}
                  >
                    <p className="font-medium text-[var(--color-text)]">{c.clientName}</p>
                    <p className="truncate text-sm text-[var(--color-text-muted)]">{c.lastMessage.content || "No messages"}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col p-0 min-h-[320px]">
          {!selected && (
            <div className="flex flex-1 items-center justify-center p-6 text-[var(--color-text-muted)]">
              Select a conversation
            </div>
          )}
          {selected && (
            <>
              <div className="border-b border-[var(--color-border)] px-4 py-3 font-medium text-[var(--color-text)]">
                {clientName}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingThread && <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>}
                {!loadingThread && messages.map((m) => {
                  const isCoach = m.senderId === coachId;
                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg px-3 py-2 max-w-[85%] ${isCoach ? "ml-auto mr-0 bg-[var(--color-primary-subtle)]" : "ml-0 mr-auto bg-[var(--color-bg-elevated)]"}`}
                    >
                      <p className="text-xs font-medium text-[var(--color-text-muted)]">{isCoach ? "You" : (m.senderName || "Client")}</p>
                      <p className="text-sm text-[var(--color-text)]">{m.content}</p>
                      {m.timestamp && <p className="text-xs text-[var(--color-text-muted)] mt-1">{formatDateTimeDisplay(m.timestamp)}</p>}
                    </div>
                  );
                })}
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
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
