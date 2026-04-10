import fs from "node:fs";
import path from "node:path";

export type Report = {
  slug: string;
  title: string;
  subtitle: string;
  tag: string;
  file: string;
  order: number;
};

// Ordered list — this drives the sidebar nav AND the landing page
export const REPORTS: Report[] = [
  {
    slug: "why-bots-succeed-or-fail",
    title: "Why Trading Bots Succeed or Fail",
    subtitle:
      "~90% of bots lose money. Here's why — and what separates the ones that don't.",
    tag: "Research",
    file: "01-bot-success-and-failure.md",
    order: 1,
  },
  {
    slug: "successful-strategies",
    title: "Successful Trading Bot Strategies",
    subtitle:
      "Deep dive on eight strategy archetypes used by bots that actually work.",
    tag: "Research",
    file: "02-successful-strategies.md",
    order: 2,
  },
  {
    slug: "small-cap-short-hold",
    title: "Small-Cap Short-Hold Trading",
    subtitle:
      "Research specific to what ArcherStocks is actually doing — small caps, short hold times.",
    tag: "Research",
    file: "03-small-cap-short-hold.md",
    order: 3,
  },
  {
    slug: "how-archerstocks-compares",
    title: "ArcherStocks: How It Compares",
    subtitle:
      "Graded comparison of the current bot against the research. A-tier wins, F-tier gaps.",
    tag: "ArcherStocks",
    file: "04-comparison.md",
    order: 4,
  },
  {
    slug: "implementation-guide",
    title: "Implementation Guide",
    subtitle:
      "A step-by-step fix list with file paths, line numbers, and code snippets.",
    tag: "ArcherStocks",
    file: "05-implementation-guide.md",
    order: 5,
  },
];

const CONTENT_DIR = path.join(process.cwd(), "src/content/archerstocks");

export function getReportBySlug(slug: string): Report | undefined {
  return REPORTS.find((r) => r.slug === slug);
}

export function readReportMarkdown(report: Report): string {
  const filePath = path.join(CONTENT_DIR, report.file);
  return fs.readFileSync(filePath, "utf8");
}

export function getAdjacentReports(slug: string): {
  prev: Report | null;
  next: Report | null;
} {
  const idx = REPORTS.findIndex((r) => r.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? REPORTS[idx - 1] : null,
    next: idx < REPORTS.length - 1 ? REPORTS[idx + 1] : null,
  };
}
