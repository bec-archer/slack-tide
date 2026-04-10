"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import s from "./gate.module.css";

type Props = {
  redirectTo: string;
};

export default function PinForm({ redirectTo }: Props) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/archerstocks-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, redirect: redirectTo }),
      });

      if (res.status === 401) {
        setError("Incorrect PIN");
        setPin("");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError("Something went wrong. Try again.");
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { redirect?: string };
      router.push(data.redirect || "/archerstocks");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={s.form}>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="Enter PIN"
        className={s.input}
        aria-label="PIN"
      />
      {error && <p className={s.error}>{error}</p>}
      <button
        type="submit"
        disabled={loading || !pin}
        className={s.button}
      >
        {loading ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
