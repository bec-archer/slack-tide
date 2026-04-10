import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { marked } from "marked";
import {
  REPORTS,
  getReportBySlug,
  readReportMarkdown,
  getAdjacentReports,
} from "../../reports";
import s from "../../archerstocks.module.css";

type Params = { slug: string };

// Configure marked: GFM tables, header IDs for anchors
marked.setOptions({
  gfm: true,
  breaks: false,
});

export function generateStaticParams(): Params[] {
  return REPORTS.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const report = getReportBySlug(slug);
  if (!report) return { title: "Not found | ArcherStocks Research" };
  return {
    title: `${report.title} | ArcherStocks Research`,
    description: report.subtitle,
  };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const report = getReportBySlug(slug);
  if (!report) notFound();

  const md = readReportMarkdown(report);

  // Strip the leading H1 from the markdown — we render our own header
  // so the article doesn't have a duplicate title.
  const mdWithoutH1 = md.replace(/^#\s+.+\n/, "");

  const html = await marked.parse(mdWithoutH1);

  const { prev, next } = getAdjacentReports(slug);

  return (
    <article className={s.article}>
      <header className={s.reportHeader}>
        <div className={s.reportMeta}>
          <Link href="/archerstocks" className={s.backLink}>
            ← All reports
          </Link>
          <span className={s.reportTag}>{report.tag}</span>
        </div>
        <h1 className={s.reportTitle}>{report.title}</h1>
        <p className={s.reportSubtitle}>{report.subtitle}</p>
      </header>

      <div
        className={s.markdown}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <nav className={s.prevNext} aria-label="Report navigation">
        {prev ? (
          <Link
            href={`/archerstocks/reports/${prev.slug}`}
            className={s.prevNextLink}
          >
            <span className={s.prevNextDir}>← Previous</span>
            <span className={s.prevNextTitle}>{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/archerstocks/reports/${next.slug}`}
            className={`${s.prevNextLink} ${s.prevNextRight}`}
          >
            <span className={s.prevNextDir}>Next →</span>
            <span className={s.prevNextTitle}>{next.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
