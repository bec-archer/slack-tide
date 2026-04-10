import type { Metadata } from "next";
import SidebarNav from "./SidebarNav";
import { REPORTS } from "./reports";
import s from "./archerstocks.module.css";

export const metadata: Metadata = {
  title: "ArcherStocks Research",
  description:
    "Research on algorithmic trading bot success, strategies, and implementation for the ArcherStocks project.",
};

export default function ArcherStocksLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={s.page}>
      <div className={s.shell}>
        <SidebarNav reports={REPORTS} />
        <main className={s.main}>{children}</main>
      </div>
    </div>
  );
}
