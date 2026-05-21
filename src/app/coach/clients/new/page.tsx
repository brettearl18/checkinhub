"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useApiClient } from "@/lib/api-client";

export default function CoachAddNewClientPage() {
  const router = useRouter();
  const { fetchWithAuth } = useApiClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sendInviteLink, setSendInviteLink] = useState(true);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingClient, setExistingClient] = useState<{
    clientId: string;
    canViewProfile: boolean;
    canLinkToRoster: boolean;
  } | null>(null);
  const [linking, setLinking] = useState(false);
  const [success, setSuccess] = useState<{ clientId: string; inviteLink?: string | null } | null>(null);

  const handleLinkToRoster = async () => {
    if (!existingClient?.clientId) return;
    setLinking(true);
    setError(null);
    try {
      const res = await fetchWithAuth(
        `/api/coach/clients/${existingClient.clientId}/link`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Could not add client to your roster.");
        return;
      }
      router.push(`/coach/clients/${existingClient.clientId}`);
    } catch {
      setError("Could not add client to your roster.");
    } finally {
      setLinking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExistingClient(null);
    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/coach/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password: sendInviteLink ? undefined : (password || undefined),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const body = data as {
          error?: string;
          existingClientId?: string | null;
          canViewProfile?: boolean;
          canLinkToRoster?: boolean;
        };
        setError(body.error ?? "Failed to create client.");
        if (res.status === 409 && body.existingClientId) {
          setExistingClient({
            clientId: body.existingClientId,
            canViewProfile: body.canViewProfile === true,
            canLinkToRoster: body.canLinkToRoster === true,
          });
        }
        return;
      }
      setSuccess({
        clientId: (data as { clientId: string }).clientId,
        inviteLink: (data as { inviteLink?: string | null }).inviteLink ?? null,
      });
      if ((data as { createdWithPassword?: boolean }).createdWithPassword) {
        setTimeout(() => router.push(`/coach/clients/${(data as { clientId: string }).clientId}`), 1500);
      }
    } catch {
      setError("Failed to create client.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4 max-w-lg">
        <Link href="/coach/clients" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Back to clients
        </Link>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Client created</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {success.inviteLink
              ? "Send this link to your client so they can set their password and log in. The link expires in 7 days."
              : "The client can sign in with the email and password you set."}
          </p>
          {success.inviteLink && (
            <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Invite link</p>
              <p className="text-sm text-[var(--color-text)] break-all select-all">{success.inviteLink}</p>
              <Button
                variant="secondary"
                className="mt-2"
                onClick={() => navigator.clipboard.writeText(success.inviteLink!)}
              >
                Copy link
              </Button>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="primary">
              <Link href={`/coach/clients/${success.clientId}`}>Open client</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/coach/clients">Back to list</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <Link href="/coach/clients" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Back to clients
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Add new client</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Create a client and either set a password for them or send an invite link so they can set their own.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
            />
            <Input
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setExistingClient(null);
              setError(null);
            }}
            required
            autoComplete="email"
          />
          <Input
            label="Phone (optional)"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="send-invite"
              checked={sendInviteLink}
              onChange={(e) => setSendInviteLink(e.target.checked)}
              className="rounded border-[var(--color-border)]"
            />
            <label htmlFor="send-invite" className="text-sm text-[var(--color-text)]">
              Send invite link (client sets their own password; link expires in 7 days)
            </label>
          </div>

          {!sendInviteLink && (
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          )}

          {error && (
            <div
              className="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3 py-3 text-sm text-[var(--color-error)]"
              role="alert"
            >
              <p>{error}</p>
              {existingClient?.canLinkToRoster && (
                <Button
                  type="button"
                  variant="primary"
                  className="mt-3"
                  disabled={linking}
                  onClick={handleLinkToRoster}
                >
                  {linking ? "Adding…" : "Add to my roster"}
                </Button>
              )}
              {existingClient?.canViewProfile && (
                <Button asChild variant="primary" className="mt-3">
                  <Link href={`/coach/clients/${existingClient.clientId}`}>View client profile</Link>
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create client"}
            </Button>
            <Button type="button" variant="secondary" asChild>
              <Link href="/coach/clients">Cancel</Link>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
