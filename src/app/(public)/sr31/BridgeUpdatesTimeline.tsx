"use client";

import { useState } from "react";
import s from "./sr31.module.css";

interface Update {
  published_date: string;
  source_name: string;
  headline: string;
  summary: string;
  source_url: string;
}

export default function BridgeUpdatesTimeline({
  updates,
}: {
  updates: Update[];
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className={s.timeline}>
      {updates.map((u, i) => {
        const isOpen = expanded === i;
        return (
          <div key={i} className={s.timelineEntry}>
            <button
              onClick={() => setExpanded(isOpen ? null : i)}
              className={s.timelineButton}
            >
              <div>
                <p className={s.timelineHeadline}>{u.headline}</p>
                <p className={s.timelineMeta}>
                  {u.published_date} &middot; {u.source_name}
                </p>
              </div>
              <span
                className={
                  isOpen ? s.timelineChevronOpen : s.timelineChevron
                }
              >
                &#9660;
              </span>
            </button>
            {isOpen && (
              <div className={s.timelineBody}>
                <p className={s.timelineSummary}>{u.summary}</p>
                {u.source_url && (
                  <a
                    href={u.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={s.timelineLink}
                  >
                    Source &rarr;
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
