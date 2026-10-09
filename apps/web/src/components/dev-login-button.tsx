"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * DEV-ONLY bypass login. Rendered only when NEXT_PUBLIC_DEV_LOGIN==="true" (baked
 * at build; "" in prod builds → this returns null). POSTs to the dev-login
 * endpoint, which only exists when the API worker's DEV_LOGIN flag is on, then
 * hard-navigates so the new session cookie is picked up server-side.
 *
 * The endpoint also requires the per-run secret `bun run dev` prints, so other
 * devices on the network can't use it. It is asked for once per tab session and
 * never baked into the bundle (anyone who can load the page could read it).
 */
const SECRET_STORAGE_KEY = "dirework-dev-login-secret";

function readStoredSecret(): string | null {
  try {
    return window.sessionStorage.getItem(SECRET_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeSecret(secret: string | null): void {
  try {
    if (secret) window.sessionStorage.setItem(SECRET_STORAGE_KEY, secret);
    else window.sessionStorage.removeItem(SECRET_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode) — the prompt simply asks again.
  }
}

export function DevLoginButton() {
  const [loading, setLoading] = useState(false);

  if (process.env.NEXT_PUBLIC_DEV_LOGIN !== "true") return null;

  async function devLogin() {
    const secret =
      readStoredSecret() ??
      window.prompt("Paste the dev login secret printed in the `bun run dev` terminal")?.trim();
    if (!secret) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-dev-login-secret": secret },
        body: "{}",
      });
      // Handled inline, not thrown: a throw inside try/catch makes the React
      // Compiler bail out of this component.
      if (res.status === 403) {
        storeSecret(null);
        toast.error("Dev login refused — wrong secret. Copy it from the `bun run dev` output.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        toast.error(`Dev login failed (${res.status}). Is DEV_LOGIN set?`);
        setLoading(false);
        return;
      }
      storeSecret(secret);
      window.location.href = "/dashboard";
    } catch {
      toast.error("Dev login failed. Is DEV_LOGIN set?");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1 lg:items-start">
      <Button
        variant="outline"
        size="lg"
        className="gap-2 border-dashed"
        disabled={loading}
        onClick={devLogin}
      >
        <FlaskConical className="size-4" />
        {loading ? "Signing in…" : "Dev bypass login"}
      </Button>
      <span className="console-label">Local dev only</span>
    </div>
  );
}
