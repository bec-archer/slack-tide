import type { Metadata } from "next";
import PinForm from "./PinForm";
import s from "./gate.module.css";

export const metadata: Metadata = {
  title: "ArcherStocks Research — Private",
  description: "Enter the PIN to access the ArcherStocks research collection.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function GatePage({ searchParams }: Props) {
  const { redirect } = await searchParams;
  const safeRedirect =
    redirect && redirect.startsWith("/archerstocks") && !redirect.startsWith("/archerstocks-gate")
      ? redirect
      : "/archerstocks";

  return (
    <div className={s.page}>
      <div className={s.card}>
        <span className={s.eyebrow}>Private</span>
        <h1 className={s.title}>ArcherStocks Research</h1>
        <p className={s.subtitle}>
          This is a private research collection. Enter the PIN to continue.
        </p>
        <PinForm redirectTo={safeRedirect} />
      </div>
    </div>
  );
}
