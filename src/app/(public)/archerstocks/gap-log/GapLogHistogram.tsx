import g from "./gap-log.module.css";

type Bucket = {
  filter: string;
  count: number;
};

type Props = {
  histogram: Bucket[];
};

export default function GapLogHistogram({ histogram }: Props) {
  if (histogram.length === 0) {
    return (
      <p className={g.empty}>
        No rejection data yet.
        <br />
        <span className={g.emptyDetail}>
          Histogram populates after the bots run with instrumentation and the
          nightly sync completes.
        </span>
      </p>
    );
  }

  const maxCount = Math.max(...histogram.map((b) => b.count));

  return (
    <div className={g.histogram}>
      {histogram.map((bucket) => (
        <div key={bucket.filter} className={g.histRow}>
          <span className={g.histLabel}>
            {bucket.filter.replaceAll("_", " ")}
          </span>
          <div className={g.histBarWrap}>
            <div
              className={g.histBar}
              style={{ width: `${(bucket.count / maxCount) * 100}%` }}
            />
          </div>
          <span className={g.histCount}>{bucket.count}</span>
        </div>
      ))}
    </div>
  );
}
