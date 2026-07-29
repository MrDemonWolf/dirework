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
 */
export function DevLoginButton() {
  const [loading, setLoading] = useState(false);

  if (process.env.NEXT_PUBLIC_DEV_LOGIN !== "true") return null;

  async function devLogin() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(`dev-login failed (${res.status})`);
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dev login failed. Is DEV_LOGIN set?");
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
