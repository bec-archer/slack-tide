import Link from "next/link";
import { REPORTS } from "./reports";
import s from "./archerstocks.module.css";

export default function ArcherStocksHome() {
  return (
    <article className={s.article}>
      <header className={s.landingHeader}>
        <span className={s.eyebrow}>Research Collection</span>
        <h1 className={s.landingTitle}>ArcherStocks Research</h1>
        <p className={s.landingLede}>
          A five-part research collection on why trading bots succeed or fail,
          the strategies that actually work, and how the ArcherStocks bot
          stacks up against the evidence.
        </p>
      </header>

      <section className={s.landingIntro}>
        <p>
          Roughly 90% of trading bots lose money. The ones that don&apos;t
          share a surprisingly consistent DNA: a real statistical edge,
          rigorous out-of-sample validation, adaptive risk controls, and a
          human keeping watch. The research below maps that terrain in three
          layers — first the broad landscape, then the specific strategies,
          then a focused look at the small-cap short-hold playbook that
          ArcherStocks runs. The final two reports turn the lens back on
          ArcherStocks itself: where it matches the research, where it
          doesn&apos;t, and how to close the gap.
        </p>
      </section>

      <section className={s.reportGrid}>
        {REPORTS.map((r) => (
          <Link
            key={r.slug}
            href={`/archerstocks/reports/${r.slug}`}
            className={s.reportCard}
          >
            <div className={s.reportCardHeader}>
              <span className={s.reportNum}>
                {String(r.order).padStart(2, "0")}
              </span>
              <span className={s.reportCardTag}>{r.tag}</span>
            </div>
            <h2 className={s.reportCardTitle}>{r.title}</h2>
            <p className={s.reportCardSub}>{r.subtitle}</p>
            <span className={s.reportCardCta}>Read →</span>
          </Link>
        ))}
      </section>

      <footer className={s.landingFooter}>
        <p>
          Compiled April 2026. Each report is independently sourced and cites
          its references inline. The last two reports reference the
          ArcherStocks codebase directly.
        </p>
      </footer>
    </article>
  );
}
