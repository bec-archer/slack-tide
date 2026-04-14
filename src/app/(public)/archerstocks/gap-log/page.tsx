import { createServerClient } from "@/lib/supabase-server";
import s from "../archerstocks.module.css";
import g from "./gap-log.module.css";
import GapLogLookup from "./GapLogLookup";
import GapLogHistogram from "./GapLogHistogram";
import GapLogNearMisses from "./GapLogNearMisses";

export const dynamic = "force-dynamic";

export default async function GapLogPage() {
  const supabase = await createServerClient();

  // Fetch histogram (last 7 days, both accounts)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  const { data: histogramRows } = await supabase
    .from("archerstocks_rejections")
    .select("filter")
    .gte("date", sevenDaysAgo)
    .not("filter", "is", null);

  // Aggregate into buckets
  const filterCounts: Record<string, number> = {};
  for (const row of histogramRows ?? []) {
    const f = row.filter ?? "unknown";
    filterCounts[f] = (filterCounts[f] ?? 0) + 1;
  }
  const histogram = Object.entries(filterCounts)
    .map(([filter, count]) => ({ filter, count }))
    .sort((a, b) => b.count - a.count);

  // Fetch near-misses (last 14 days, filters_passed >= 4, limit 50)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000)
    .toISOString()
    .slice(0, 10);

  const { data: nearMisses } = await supabase
    .from("archerstocks_rejections")
    .select("symbol, date, account_id, filter, filters_passed, actual, threshold")
    .gte("date", fourteenDaysAgo)
    .gte("filters_passed", 4)
    .order("filters_passed", { ascending: false })
    .order("date", { ascending: false })
    .limit(50);

  return (
    <article className={s.article}>
      <header className={s.reportHeader}>
        <div className={s.reportMeta}>
          <a href="/archerstocks" className={s.backLink}>
            ← Back
          </a>
          <span className={s.reportTag}>Observability</span>
        </div>
        <h1 className={s.reportTitle}>Gap Log</h1>
        <p className={s.reportSubtitle}>
          Why didn&apos;t the bot catch that ticker? Filter rejection traces,
          histogram breakdowns, and near-misses across both strategies.
        </p>
      </header>

      <section className={g.section}>
        <h2 className={g.sectionTitle}>Symbol Lookup</h2>
        <p className={g.sectionDesc}>
          Search for a symbol to see the full filter-chain trace for a given
          date. Shows events from both momentum and scalper bots.
        </p>
        <GapLogLookup />
      </section>

      <section className={g.section}>
        <h2 className={g.sectionTitle}>Rejection Histogram</h2>
        <p className={g.sectionDesc}>
          Which filters are rejecting the most symbols? Last 7 days, both bots
          combined.
        </p>
        <GapLogHistogram histogram={histogram} />
      </section>

      <section className={g.section}>
        <h2 className={g.sectionTitle}>Near Misses</h2>
        <p className={g.sectionDesc}>
          Symbols that passed 4+ filters but still got rejected. These are the
          best candidates for filter tuning. Last 14 days.
        </p>
        <GapLogNearMisses items={nearMisses ?? []} />
      </section>
    </article>
  );
}
