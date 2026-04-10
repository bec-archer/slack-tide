"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./archerstocks.module.css";
import type { Report } from "./reports";

type Props = {
  reports: Report[];
};

export default function SidebarNav({ reports }: Props) {
  const pathname = usePathname();
  const isHome = pathname === "/archerstocks";

  return (
    <nav className={s.sidebar} aria-label="Research navigation">
      <Link
        href="/archerstocks"
        className={`${s.sidebarHome} ${isHome ? s.sidebarItemActive : ""}`}
      >
        <span className={s.sidebarHomeTitle}>ArcherStocks Research</span>
        <span className={s.sidebarHomeSub}>Overview</span>
      </Link>

      <div className={s.sidebarDivider} />

      <ul className={s.sidebarList}>
        {reports.map((r) => {
          const href = `/archerstocks/reports/${r.slug}`;
          const active = pathname === href;
          return (
            <li key={r.slug}>
              <Link
                href={href}
                className={`${s.sidebarItem} ${
                  active ? s.sidebarItemActive : ""
                }`}
              >
                <span className={s.sidebarNum}>
                  {String(r.order).padStart(2, "0")}
                </span>
                <span className={s.sidebarLabel}>
                  <span className={s.sidebarItemTitle}>{r.title}</span>
                  <span className={s.sidebarTag}>{r.tag}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className={s.sidebarFooter}>
        <p className={s.sidebarFooterText}>
          Five-part research collection on algorithmic trading, compiled for
          the ArcherStocks project.
        </p>
      </div>
    </nav>
  );
}
