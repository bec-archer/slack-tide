import g from "./gap-log.module.css";

type NearMissRow = {
  symbol: string;
  date: string;
  account_id: string;
  filter: string | null;
  filters_passed: number;
  actual: number | null;
  threshold: number | null;
};

type Props = {
  items: NearMissRow[];
};

export default function GapLogNearMisses({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className={g.empty}>
        No near misses found.
        <br />
        <span className={g.emptyDetail}>
          Symbols that passed 4+ filters but didn&apos;t fire will appear here
          after data syncs.
        </span>
      </p>
    );
  }

  return (
    <div className={g.traceTable}>
      <div className={g.nearMissHeader}>
        <span>Symbol</span>
        <span>Date</span>
        <span>Bot</span>
        <span>Failed Filter</span>
        <span>Actual</span>
        <span>Threshold</span>
        <span>Passed</span>
      </div>
      {items.map((row, i) => (
        <div
          key={`${row.symbol}-${row.date}-${row.account_id}-${i}`}
          className={g.traceRow}
        >
          <span className={g.symbolCell}>{row.symbol}</span>
          <span className={g.mono}>{row.date}</span>
          <span className={g.tag} data-bot={row.account_id}>
            {row.account_id === "scalper" ? "SCALP" : "MOM"}
          </span>
          <span>{row.filter?.replaceAll("_", " ") ?? "—"}</span>
          <span className={g.mono}>{formatNum(row.actual)}</span>
          <span className={g.mono}>{formatNum(row.threshold)}</span>
          <span className={g.passedBadge}>{row.filters_passed}</span>
        </div>
      ))}
    </div>
  );
}

function formatNum(v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}
