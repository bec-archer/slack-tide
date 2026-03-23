import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import BridgeUpdatesTimeline from "./BridgeUpdatesTimeline";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "SR-31 Bridge Status | Wilson Pigott Bridge",
  description:
    "Live construction status for the Wilson Pigott Bridge (SR-31) over the Caloosahatchee River in Lee County, Florida.",
};

const STATUS_CONFIG = {
  OPEN: { color: "#4ade80", label: "OPEN", bg: "rgba(74, 222, 128, 0.1)", border: "rgba(74, 222, 128, 0.3)" },
  RESTRICTED: { color: "#fbbf24", label: "RESTRICTED", bg: "rgba(251, 191, 36, 0.1)", border: "rgba(251, 191, 36, 0.3)" },
  CLOSED: { color: "#f87171", label: "CLOSED", bg: "rgba(248, 113, 113, 0.1)", border: "rgba(248, 113, 113, 0.3)" },
  UNKNOWN: { color: "#64748b", label: "UNKNOWN", bg: "rgba(100, 116, 139, 0.1)", border: "rgba(100, 116, 139, 0.3)" },
} as const;

type BridgeStatusKey = keyof typeof STATUS_CONFIG;

async function getBridgeData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [statusRes, updatesRes] = await Promise.all([
    supabase
      .from("bridge_status")
      .select("*")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("bridge_updates")
      .select("*")
      .order("published_date", { ascending: false })
      .limit(20),
  ]);

  return {
    status: statusRes.data,
    updates: updatesRes.data ?? [],
  };
}

export default async function SR31Page() {
  const { status, updates } = await getBridgeData();

  const bridgeStatus = (status?.bridge_status as BridgeStatusKey) || "UNKNOWN";
  const config = STATUS_CONFIG[bridgeStatus] || STATUS_CONFIG.UNKNOWN;
  const restrictions: string[] = status?.current_restrictions ?? [];
  const alerts: string[] = status?.alerts ?? [];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        fontFamily: "var(--font-mono)",
        color: "var(--text-primary)",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px 60px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p
            style={{
              fontSize: 12,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
              marginBottom: 8,
            }}
          >
            Lee County, Florida
          </p>
          <h1
            style={{
              fontSize: "clamp(24px, 5vw, 36px)",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Wilson Pigott Bridge
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 6 }}>
            SR-31 over the Caloosahatchee River
          </p>
        </div>

        {/* Status Badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 24px",
              borderRadius: 100,
              background: config.bg,
              border: `1px solid ${config.border}`,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: config.color,
                boxShadow: `0 0 8px ${config.color}, 0 0 20px ${config.color}40`,
                animation: "pulse-glow 2s ease-in-out infinite",
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: config.color, letterSpacing: 2 }}>
              {config.label}
            </span>
          </div>
        </div>

        {/* Alert Banners */}
        {alerts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {alerts.map((alert, i) => (
              <div
                key={i}
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: config.bg,
                  borderLeft: `3px solid ${config.color}`,
                  fontSize: 13,
                  color: "var(--text-primary)",
                  lineHeight: 1.5,
                }}
              >
                <span style={{ fontWeight: 600, marginRight: 8, color: config.color }}>ALERT</span>
                {alert}
              </div>
            ))}
          </div>
        )}

        {/* Current Status Card */}
        {status?.status_detail && (
          <div className="card-static" style={{ marginBottom: 20, padding: 24 }}>
            <h2
              style={{
                fontSize: 11,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
                marginTop: 0,
                marginBottom: 10,
              }}
            >
              Current Status
            </h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
              {status.status_detail}
            </p>
            {status.source_updated && (
              <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--text-tertiary)" }}>
                Source updated: {status.source_updated}
              </p>
            )}
          </div>
        )}

        {/* Two-Column Grid: Upcoming Closure + Active Restrictions */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
            marginBottom: 20,
          }}
        >
          {/* Upcoming Closure */}
          <div className="card-static" style={{ padding: 24 }}>
            <h2
              style={{
                fontSize: 11,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
                marginTop: 0,
                marginBottom: 14,
              }}
            >
              Upcoming Closure
            </h2>
            {status?.upcoming_closure_date ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Date</span>
                  <p style={{ margin: "2px 0 0", fontSize: 14, color: "var(--text-primary)" }}>
                    {status.upcoming_closure_date}
                  </p>
                </div>
                {status.upcoming_closure_duration && (
                  <div>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Duration</span>
                    <p style={{ margin: "2px 0 0", fontSize: 14, color: "var(--text-primary)" }}>
                      {status.upcoming_closure_duration}
                    </p>
                  </div>
                )}
                {status.upcoming_closure_reason && (
                  <div>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Reason</span>
                    <p style={{ margin: "2px 0 0", fontSize: 14, color: "var(--text-secondary)" }}>
                      {status.upcoming_closure_reason}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-tertiary)" }}>
                No upcoming closures scheduled
              </p>
            )}
          </div>

          {/* Active Restrictions */}
          <div className="card-static" style={{ padding: 24 }}>
            <h2
              style={{
                fontSize: 11,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
                marginTop: 0,
                marginBottom: 14,
              }}
            >
              Active Restrictions
            </h2>
            {restrictions.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                {restrictions.map((r, i) => (
                  <li key={i} style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-tertiary)" }}>
                No active restrictions
              </p>
            )}
          </div>
        </div>

        {/* Detour Route */}
        {status?.detour_info && (
          <div className="card-static" style={{ marginBottom: 32, padding: 24 }}>
            <h2
              style={{
                fontSize: 11,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
                marginTop: 0,
                marginBottom: 10,
              }}
            >
              Detour Route
            </h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
              {status.detour_info}
            </p>
          </div>
        )}

        {/* Recent Updates Timeline */}
        {updates.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontSize: 11,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
                marginBottom: 16,
              }}
            >
              Recent Updates
            </h2>
            <BridgeUpdatesTimeline updates={updates} />
          </div>
        )}

        {/* Quick Links */}
        <div className="card-static" style={{ padding: 24, marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
              marginTop: 0,
              marginBottom: 14,
            }}
          >
            Quick Links
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {[
              { label: "FL511.com", href: "https://fl511.com" },
              { label: "SWFLRoads.com", href: "https://www.swflroads.com" },
              { label: "WGCU Transportation", href: "https://news.wgcu.org/transportation" },
              {
                label: "FDOT Roadwatch",
                href: "https://fdotewp1.dot.state.fl.us/roadwatch/",
              },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--accent-primary)",
                  fontSize: 12,
                  textDecoration: "none",
                  transition: "border-color 0.2s",
                }}
              >
                {link.label} &rarr;
              </a>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", paddingTop: 16 }}>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
            Built for the SR-31 commuters. Data refreshes automatically twice daily.
          </p>
        </div>
      </div>

      {/* Glow animation */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px ${config.color}, 0 0 20px ${config.color}40; }
          50% { opacity: 0.6; box-shadow: 0 0 4px ${config.color}, 0 0 10px ${config.color}20; }
        }
      `}</style>
    </div>
  );
}
