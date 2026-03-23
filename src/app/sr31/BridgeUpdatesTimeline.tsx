"use client";

import { useState } from "react";

interface Update {
  published_date: string;
  source_name: string;
  headline: string;
  summary: string;
  source_url: string;
}

export default function BridgeUpdatesTimeline({ updates }: { updates: Update[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {updates.map((u, i) => {
        const isOpen = expanded === i;
        return (
          <div
            key={i}
            className="card-static"
            style={{ padding: 0, cursor: "pointer", overflow: "hidden" }}
          >
            <button
              onClick={() => setExpanded(isOpen ? null : i)}
              style={{
                width: "100%",
                background: "none",
                border: "none",
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
                textAlign: "left",
                color: "inherit",
                fontFamily: "inherit",
              }}
            >
              {/* Timeline dot */}
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--accent-primary)",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {u.headline}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-tertiary)" }}>
                  {u.published_date} &middot; {u.source_name}
                </p>
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-tertiary)",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                  flexShrink: 0,
                }}
              >
                &#9660;
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: "0 20px 14px 38px" }}>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "var(--text-secondary)",
                  }}
                >
                  {u.summary}
                </p>
                {u.source_url && (
                  <a
                    href={u.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 11,
                      color: "var(--accent-primary)",
                      textDecoration: "none",
                    }}
                  >
                    View source &rarr;
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
