"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import g from "./gap-log.module.css";

type TraceRow = {
  id: number;
  timestamp: string;
  account_id: string;
  filter: string | null;
  filters_passed: number | null;
  actual: number | null;
  threshold: number | null;
  context: Record<string, unknown> | null;
};

export default function GapLogLookup() {
  const [symbol, setSymbol] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [results, setResults] = useState<TraceRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const supabase = createBrowserClient();
      const { data, error: err } = await supabase
        .from("archerstocks_rejections")
        .select("id, timestamp, account_id, filter, filters_passed, actual, threshold, context")
        .eq("symbol", sym)
        .eq("date", date)
        .order("timestamp", { ascending: true });

      if (err) throw err;
      setResults(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className={g.lookupForm}>
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="RMSG"
          className={g.input}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={g.input}
        />
        <button
          onClick={search}
          disabled={!symbol.trim() || loading}
          className={g.button}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <p className={g.error}>{error}</p>}

      {results !== null && results.length === 0 && (
        <p className={g.empty}>
          No rejection events for {symbol.toUpperCase()} on {date}.
          <br />
          <span className={g.emptyDetail}>
            Instrumentation went live 2026-04-15. Data syncs nightly at 3 AM ET.
          </span>
        </p>
      )}

      {results && results.length > 0 && (
        <div className={g.traceTable}>
          <div className={g.traceHeader}>
            <span>Time</span>
            <span>Bot</span>
            <span>Filter</span>
            <span>Actual</span>
            <span>Threshold</span>
            <span>Passed</span>
          </div>
          {results.map((row) => (
            <div key={row.id} className={g.traceRow}>
              <span className={g.mono}>
                {row.timestamp?.split("T")[1]?.slice(0, 8) ?? ""}
              </span>
              <span className={g.tag} data-bot={row.account_id}>
                {row.account_id === "scalper" ? "SCALP" : "MOM"}
              </span>
              <span>{formatFilter(row.filter)}</span>
              <span className={g.mono}>{formatNum(row.actual)}</span>
              <span className={g.mono}>{formatNum(row.threshold)}</span>
              <span className={g.mono}>{row.filters_passed ?? "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatFilter(f: string | null): string {
  if (!f) return "—";
  return f.replaceAll("_", " ");
}

function formatNum(v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}
