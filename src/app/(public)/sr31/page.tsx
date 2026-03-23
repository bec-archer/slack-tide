import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import BridgeUpdatesTimeline from "./BridgeUpdatesTimeline";
import s from "./sr31.module.css";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "SR-31 Bridge Status | Wilson Pigott Bridge",
  description:
    "Live construction status for the Wilson Pigott Bridge (SR-31) over the Caloosahatchee River in Lee County, Florida.",
};

const STATUS_CONFIG = {
  OPEN: { color: "var(--sr-green)", label: "OPEN" },
  RESTRICTED: { color: "var(--sr-amber)", label: "RESTRICTED" },
  CLOSED: { color: "var(--sr-red)", label: "CLOSED" },
  UNKNOWN: { color: "var(--sr-text-3)", label: "UNKNOWN" },
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

function RouteShield() {
  return (
    <div className={s.shield}>
      <svg viewBox="0 0 80 80" fill="none" className={s.shieldSvg}>
        <path
          d="M40 4C28 4 18 8 10 16L8 18V56L10 58C18 66 28 74 40 76C52 74 62 66 70 58L72 56V18L70 16C62 8 52 4 40 4Z"
          fill="#1a1c1e"
          stroke="#3a3835"
          strokeWidth="2"
        />
        <text
          x="40"
          y="36"
          textAnchor="middle"
          fill="#9b9590"
          fontSize="11"
          fontWeight="700"
          fontFamily="'Plus Jakarta Sans', sans-serif"
          letterSpacing="0.05em"
        >
          SR
        </text>
        <text
          x="40"
          y="56"
          textAnchor="middle"
          fill="#e8e4df"
          fontSize="22"
          fontWeight="800"
          fontFamily="'Plus Jakarta Sans', sans-serif"
          letterSpacing="-0.02em"
        >
          31
        </text>
      </svg>
    </div>
  );
}

export default async function SR31Page() {
  const { status, updates } = await getBridgeData();

  const bridgeStatus = (status?.bridge_status as BridgeStatusKey) || "UNKNOWN";
  const config = STATUS_CONFIG[bridgeStatus] || STATUS_CONFIG.UNKNOWN;
  const restrictions: string[] = status?.current_restrictions ?? [];
  const alerts: string[] = status?.alerts ?? [];

  return (
    <div className={s.page}>
      <div className={s.container}>
        {/* Header with route shield */}
        <header className={s.header}>
          <RouteShield />
          <div className={s.headerText}>
            <h1 className={s.bridgeName}>Wilson Pigott Bridge</h1>
            <p className={s.bridgeSubtitle}>
              SR-31 over the Caloosahatchee &middot; Lee County, FL
            </p>
          </div>
        </header>

        {/* Status block */}
        <div className={s.statusBlock}>
          <div className={s.statusRow}>
            <span
              className={s.statusDot}
              style={{ background: config.color }}
            />
            <span
              className={s.statusLabel}
              style={{ color: config.color }}
            >
              {config.label}
            </span>
          </div>
          {status?.status_detail && (
            <p className={s.statusDetail}>{status.status_detail}</p>
          )}
          {status?.source_updated && (
            <p className={s.sourceUpdated}>
              Last source update: {status.source_updated}
            </p>
          )}
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className={s.alerts}>
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={s.alert}
                style={{ borderLeftColor: config.color }}
              >
                <span className={s.alertLabel} style={{ color: config.color }}>
                  Alert
                </span>
                {alert}
              </div>
            ))}
          </div>
        )}

        {/* Two-panel grid: Closure + Restrictions */}
        <div className={s.infoGrid}>
          <div className={s.infoPanel}>
            <h2 className={s.infoPanelTitle}>Upcoming Closure</h2>
            {status?.upcoming_closure_date ? (
              <>
                <div className={s.infoRow}>
                  <div className={s.infoKey}>Date</div>
                  <p className={s.infoValue}>{status.upcoming_closure_date}</p>
                </div>
                {status.upcoming_closure_duration && (
                  <div className={s.infoRow}>
                    <div className={s.infoKey}>Duration</div>
                    <p className={s.infoValue}>
                      {status.upcoming_closure_duration}
                    </p>
                  </div>
                )}
                {status.upcoming_closure_reason && (
                  <div className={s.infoRow}>
                    <div className={s.infoKey}>Reason</div>
                    <p className={s.infoValueMuted}>
                      {status.upcoming_closure_reason}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className={s.emptyState}>No closures scheduled</p>
            )}
          </div>

          <div className={s.infoPanel}>
            <h2 className={s.infoPanelTitle}>Active Restrictions</h2>
            {restrictions.length > 0 ? (
              <ul className={s.restrictionList}>
                {restrictions.map((r, i) => (
                  <li key={i} className={s.restrictionItem}>
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.emptyState}>No active restrictions</p>
            )}
          </div>
        </div>

        {/* Detour */}
        {status?.detour_info && (
          <div className={s.section}>
            <h2 className={s.sectionLabel}>Detour Route</h2>
            <p className={s.detourText}>{status.detour_info}</p>
          </div>
        )}

        {/* Updates timeline */}
        {updates.length > 0 && (
          <div className={s.section}>
            <h2 className={s.sectionLabel}>Recent Updates</h2>
            <BridgeUpdatesTimeline updates={updates} />
          </div>
        )}

        {/* Quick links */}
        <div className={s.section}>
          <h2 className={s.sectionLabel}>Resources</h2>
          <div className={s.quickLinks}>
            {[
              { label: "FL511", href: "https://fl511.com" },
              { label: "SWFLRoads", href: "https://www.swflroads.com" },
              {
                label: "WGCU Transportation",
                href: "https://news.wgcu.org/transportation",
              },
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
                className={s.quickLink}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className={s.footer}>
          Built for SR-31 commuters. Data refreshes twice daily.
        </footer>
      </div>
    </div>
  );
}
