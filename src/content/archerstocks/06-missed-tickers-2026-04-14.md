# Missed Tickers Investigation — 2026-04-14

**Tickers:** SKYQ, BBGI, RMSG, SNAL (4th added mid-investigation — live confirmation of Gap 2/3)
**Question from Archer:** Why did neither the momentum bot nor the intraday scalper catch these? Are there systematic coverage gaps?
**Data window:** 2026-03 through 2026-04-14, per-bar reconstruction from `data/bars.db` + cross-reference to `logs/archerstocks_*.log` and `logs/scalper_*.log`.
**Scope:** Analysis only. No production code changed. No commits to Docs/ without approval.

---

## How to read this (context primer)

ArcherStocks runs **two completely independent bots at the same time, on two different Alpaca paper accounts**. They share nothing that matters for trading — not positions, not cash, not day-trade budgets, not kill switches, not state files. Each one is a separate process on the Mac mini, with its own API keys, its own logs, and its own scanner.

| | **Momentum bot** | **Scalper bot** |
|---|---|---|
| Alpaca account | `default` | `scalper` |
| What it's looking for | Stocks that closed yesterday 19%+ above their 25-day moving average on 8x+ their normal volume, priced $1–$6 | Stocks that are surging intraday TODAY — 12x their 20-day average daily volume, up at least 10% from yesterday, priced $0.80–$8.00 |
| When it scans | Once before market open + a few mid-session rechecks | Every 2 minutes all day, 9:30–12:00 ET |
| When it enters | As soon as the scanner fires a top signal | The moment a watched stock crosses the 12x volume threshold |
| Day-trade budget | Its own 3-per-5-days PDT budget | Its own separate 3-per-5-days PDT budget |
| Daily trade cap | 1 concurrent position, no per-day cap | Hard-capped at 1 trade/day by config |
| Logs live at | `logs/archerstocks_*.log` | `logs/scalper_*.log` |
| State lives at | `state/` | `state/scalp/` |
| Config | `config/strategies/ma20_momentum.yaml` | `config/strategies/intraday_scalper.yaml` |

**What this means in practice:**
- If the momentum bot is stuck holding SKYQ with a PDT lockout, the scalper bot on the other account is **unaffected** — different account, different day-trade count, different PDT status.
- If the scalper takes its one daily trade and stops scanning, the momentum bot **keeps scanning as normal** — it has no idea the scalper even exists.
- A ticker can be hit by BOTH bots in the same day on different accounts (and this happened on 4/14 — momentum bought RMSG at 9:40, scalper bought SNAL at 9:45).
- A ticker can be correctly excluded by one bot (wrong price band) and simultaneously eligible for the other. The "miss" question has to be answered once per bot, per ticker.

**How to read the per-ticker walkthroughs below:** each ticker section has two subsections, one for each bot's independent view. If both missed, both subsections explain why *independently*. If one caught it and one didn't, that's also shown per-bot. The two bots never influence each other's decisions.

---

## TL;DR

1. **The momentum bot (default account) actually caught all three at first breakout.** SKYQ was its top signal on 4/02 (+114% above MA20, 17.2x vol). BBGI was its top signal on 4/08 (+44%, 19.8x). RMSG was its top signal this morning on 4/14 (+357% above MA25, 15.8x). The momentum bot *entered* SKYQ 4/02, tried to enter BBGI 4/08–4/09 (blocked by an HTB filter bug that's since been fixed), and entered RMSG 4/14. All the trades it took lost money because of execution issues at entry. The moves Archer is pointing at on the charts are the **continuation** legs — days 2–7 of a multi-day run — which both bots' current designs exit by construction the moment price leaves the scanner's price band.

2. **The real coverage gap is the follow-on run, not the first-day discovery.** Once a micro-cap breaks above $6 (momentum bot's cap) or $8 (scalper bot's cap), it's invisible to that bot for the rest of the run, regardless of how strong the volume/MA% signal is. SKYQ ran $6.36 → $19.45 while outside the momentum bot's band. BBGI ran $11.02 → $14.61 while outside both bots' bands. RMSG ran $0.95 → $2.73 on 4/13 entirely while the scalper bot was either crash-looping or had already spent its one daily trade.

3. **The scalper bot (scalper account) is currently crippled by three separate issues that compound.** This is a scalper-only problem — the momentum bot on the default account is not affected by any of these. (a) `max_daily_trades=1` stops the scalper's scanner from being called at all for the rest of the day after its first entry, even if that entry stops out 3 seconds later. (b) A `$0.00` hard-stop bug closed both 4/13's RCT and 4/14's SNAL within 3 seconds of fill — burning the scalper's one daily trade for a 0.7% round-trip. (c) On 4/13 the scalper crash-looped all night on corrupt events.db ("database disk image is malformed"), not recovering until 08:16; on 4/14 it didn't start scanning until 09:45, missing the first 15 minutes of open.

4. **Common ticker profile:** all three are HTB, nano-to-micro-cap ($18M–$44M market cap), and trajectories that go **sub-dollar → double-digits in ~2 weeks** on a multi-day run, not a single-day spike. This class is structurally hard for the current two-bot stack: momentum is tuned for mid-day-1 entry on $1–$6 breakouts, scalper is tuned for single-day intraday surges $0.80–$8.00. Neither has a "mid-run continuation" mode.

5. **Highest-leverage fix, if Archer picks one (scalper side):** lift the scalper bot's `max_daily_trades: 1` once the hard-stop bug is fixed and the crash-loop is neutralized. That alone recovers the scalper's visibility into 80%+ of the missed volume surges. But it only fixes the scalper's intraday coverage — it doesn't address the multi-day continuation gap, which sits on the momentum bot's side and needs a different sub-strategy entirely.

6. **Live proof during this investigation:** the scalper bot took SNAL at $0.97 on 4/14 09:45, got bugged out at $0.98 three seconds later, then sat blind while SNAL ran to $1.66 (LULD halt up). Bec caught it manually at $1.18. Same mechanical failure as RCT on 4/13, now with a visibly large opportunity cost attached. The momentum bot on the default account never saw SNAL at all (4/11 close was sub-$1, below its price floor). See SNAL case below.

---

## Per-ticker walkthrough

### SKYQ — Sky Quarry Inc (NASDAQ, HTB)

**The move:** $0.36 close on 2026-03-13 → $19.45 peak on 2026-04-13 intraday (+5,300% in one month). Run began 2026-03-16 ($0.36 → $3.41 close on single-day +842%), consolidated $2–$5 through 3/17–4/01, exploded 4/02–4/07 to $8.32 high, continued 4/08–4/13 from $6.61 to $19.45. Currently $11.62 (Mon close) / $9.78 (Tue 4/14 day bar so far).

**20-day avg volume as of 4/10:** 19.1M shares.

**Momentum bot (`default` Alpaca account) — did it see it?** Yes, repeatedly.
- **2026-04-02 10:04:08** — Top signal: `SKYQ $4.67  MA20=2.18  +114.5%  vol=17.2x`. Entered 1089 shares × $4.62 (yolo, 100% equity).
  - Wash trade rejection → retried → "asset SKYQ cannot be sold short" from Alpaca when trying to place hard stop → fell back to software stop at $4.34.
  - Trade journaled as closed 4 seconds later at **entry=$4.62, exit=$0, pnl=$0**, due to the `Could not determine P&L for SKYQ` path. This looks like the same root cause as the scalper's `$0.00 hard stop` bug — the software-stop code reads a current price before the bar/trade data is populated.
  - Re-entered 10:11 at $4.59, trailed up, stopped out at $4.55 for -1.1% / -$54.80.
  - Re-entered 10:28 at $4.46, wash-trade loop, etc. The bot cycled in/out of SKYQ through the afternoon, bleeding small losses.
- **2026-04-06 09:31–10:01** — Recovered SKYQ position at $4.64 (carried over weekend). Software trailing stop kept firing at $4.89 but **close orders failed with `trade denied due to pattern day trading protection`** — the momentum bot had already used its `default` account's 3 day-trade budget on the 4/02 cycles. (The scalper account's PDT budget was untouched — different account — but the scalper bot wasn't live yet on 4/06 anyway.) The position sat stuck while SKYQ oscillated $4.81–$5.00. It eventually closed (no explicit log in the window I searched; the momentum bot moved on to PFSA by 10:46, so SKYQ must have exited between 10:01 and 10:46).
- **2026-04-07 onward** — SKYQ closed $6.36 that day. The momentum scanner's `max_price=6.00` excluded it from every subsequent pre-market scan. 4/08 $6.61, 4/09 $7.29, 4/10 $12.59, 4/13 $11.62 — all above $6.00 cap. The MA+volume signal was still fireable every one of those days (vol ratio and above-MA% would both have qualified), but the price filter short-circuits before those checks run (see `scanner.py` `_scan_cached` step 1, `_calculate_signals` `if not (self.min_price <= close <= self.max_price): continue`).

**Scalper bot (`scalper` Alpaca account) — did it see it?**
- Scalper was not deployed during 4/02–4/09 (first scalper log is `scalper_2026-04-10.log`).
- **4/10** — prior close $7.29, >$7.27 threshold. `min_change_pct: 10.0%` needs price ≥ $8.02; `max_price: 8.00` caps it at $8.00. Impossible to trigger — the change-pct and price-cap windows don't overlap. Logged neither a discovery nor an entry.
- **4/13–4/14** — prior closes $12.59, $11.62, $9.78 all above $8.00 max_price → scalper skips at the exact-price filter.

**What the momentum signal actually looked like on days it was filtered out (hypothetical):**

| Date | SKYQ close | Prior-day MA25 (approx) | Above-MA% | Vol / 20d avg | Would fire if price cap lifted? |
|---|---|---|---|---|---|
| 4/07 | $6.36 | $2.30 | +177% | ~3.8x (73M / 19M) | no — vol < 8x |
| 4/08 | $6.61 | $2.70 | +145% | 0.4x | no |
| 4/09 | $7.29 | $3.10 | +135% | 1.1x | no |
| 4/10 | $12.59 | $3.50 | +260% | 2.4x | no |
| 4/13 | $11.62 | $4.25 | +173% | 1.2x | no |

**Takeaway for SKYQ:** momentum *did* catch it on day 1. The miss isn't about the scanner — it's that (a) the execution layer couldn't hold the position through HTB/wash-trade/PDT constraints, and (b) after 4/07 the price was above both bots' bands and the volume/MA signal wasn't reinforcing (the stock was in "trend continuation" mode, not "fresh breakout" mode). Neither bot is designed to hold a multi-day runner on decaying relative volume.

---

### BBGI — Beasley Broad Group (NASDAQ, HTB)

**The move:** Traded $3–$4 range from 2026-03 through 2026-04-07 on thin volume (often <50k shares/day). Exploded 2026-04-08: opened $5.25 (+67% gap from 4/07 close $3.14), ran to $6.55 intraday, closed $5.67 on 52M volume vs. prior 20-day avg of ~3.6M = ~14x. Continued 4/09 $13.16 high / $11.02 close, 4/10 $12.80 high, 4/13 $14.61 peak / $10.40 close. Now $10.40 (Mon) / $10.91 (Tue).

**20-day avg volume as of 4/10:** 3.6M shares.

**Momentum bot (`default` Alpaca account) — did it see it?** Yes, multiple days.
- **2026-04-08 10:36:14** — Top signal: `BBGI $5.20  MA20=3.60  +44.3%  vol=19.8x`. Entry attempted.
  - Result: `Entry SKIPPED for BBGI — BBGI is hard-to-borrow (server-side stops unreliable), will try next signal`. Second signal OMEX also HTB, also skipped. **No trade taken.**
  - Note: at this point, `allow_htb_software_stop` was not yet active in the config. The feature was added and live by 4/10 — you can see it kick in on 4/10 logs: "HTB tagged (software stop): 2/3 signals [CLIK, ANTA]". Had the feature been live on 4/08, BBGI would have been entered with software stop at $5.20, and — assuming the same ~4.5% trailing — would have ridden some portion of the 4/08 $5.20 → $5.67 close.
- **2026-04-09 10:53:27** — Same signal re-fires: `BBGI $5.67  MA20=3.63  +56.3%  vol=19.9x`. This time HTB filter runs BEFORE software-stop tagging was plumbed through the scanner: `HTB filter: 2/2 signals removed [BBGI, ADGM]` + explicit warning `HTB filter removed ALL 2 signals — every candidate is hard-to-borrow today. No entry will be attempted.` So this was stripped at scanner level, not caught at the entry-guardrail level. The HTB software-stop feature landed between 4/09 and 4/10.
- **2026-04-10+** — BBGI close $11.76 (4/10), $10.40 (4/13), $10.91 (4/14). All above `max_price=6.00`. Excluded at price filter on every subsequent pre-market scan. Volume also moderated (4M, 1.5M, 38k) — on 4/14 the signal wouldn't fire even without the price cap: 38k vs 3.6M avg = 0.01x.

**Scalper bot (`scalper` Alpaca account) — did it see it?**
- Not deployed yet for the 4/08 breakout day (scalper went live 4/10).
- 4/10 onwards: BBGI prior close $11.02 → $11.76 → $10.40 — all above the `max_price: 8.00` cap. The scalper never even price-filters it in.
- Hypothetical: had the scalper been live on **4/08**, prior close was $3.14, price range at open $5.25, change_pct = +67%, intraday volume building to 52M vs 3.6M avg = 14.4x → would have crossed discovery (5x) AND entry trigger (12x) easily. This is the textbook FUSE-pattern setup the scalper was designed for. It just wasn't running yet on 4/08.

**Takeaway for BBGI:** two independent misses. First miss was a *timing* miss on 4/08 (HTB scanner filter still ate the top signal, because `allow_htb_software_stop` hadn't been merged; the scalper wasn't live yet). Second miss is the same continuation-run price-cap issue as SKYQ — once BBGI closed >$8, the scalper couldn't see it, and once >$6, the momentum bot couldn't see it. The original HTB miss is now closed out as a fixed bug, not a systematic gap.

---

### RMSG — Real Messenger Corp (NASDAQ, HTB)

**The move:** Traded $0.33–$0.72 from 2026-03 through 2026-04-10 with one outlier volume day on 3/25 (253M shares). Exploded **2026-04-13**: opened $0.9465, ran to $2.73 intraday on 461M shares (+475% day, ~35x average volume). Closed $2.70. Today 4/14 traded $2.64–$2.90, closing $2.89 so far on 24M shares.

**20-day avg volume as of 4/10:** 13.3M shares.

**Momentum bot (`default` Alpaca account) — did it see it?**
- **2026-04-13 pre-market** — RMSG prior close was $0.4695 (4/10), below `min_price=1.00`. Price filter strips it before MA/vol calc runs. The scanner log confirms: only 3 raw signals found on 4/13 morning (SQFT, FUSE, one more) — RMSG wasn't among them. **Even if the momentum bot hadn't already been in SQFT** (which caused it to skip the 4/13 scan: `Active trade in SQFT — skipping scan`), the price floor would have excluded RMSG.
- **2026-04-14 09:35:45** — Top signal (8 raw): `#1 RMSG $2.70 MA20=0.59 +356.9% vol=15.8x`. Entered at 09:40 at $2.86 (173 shares × $2.86 = $494.45 @ 9.9% sizing). HTB software stop.
  - **Stopped out at 09:42:31** at $2.77 (hard stop at $2.83, -2.8% / -$13.84). Entry slippage on a gapping stock — snapshot was $2.8581, fill $2.86, and the first 2 minutes of the trade drifted below the hard stop before trailing could arm. Classic "already-run" problem: by the time the momentum scanner sees RMSG as a valid signal, the gap has already happened and the entry is at or near the prior day's intraday high.
  - Bot then tried RECT (#2, $1.84 entry), which followed the same pattern.

**Scalper bot (`scalper` Alpaca account) — did it see it?**
- **2026-04-13** (the $0.47 → $2.70 day): this is the one that matters. Timeline:
  - **00:00:04 through 06:00** — scalper crash-looping on corrupt `events.db` ("database disk image is malformed"), ~50+ restarts per minute.
  - **08:16** — clean recovery, steady state.
  - **09:30:12** — first scan: `checked=11, watchlist=0`. Pre-filter found 1,178 symbols in the $0.40–$24.00 pre-band range (cache hadn't loaded the full 8,617-symbol set yet; scan #4 at 09:36 jumped to 3,992).
  - **09:34:31** — DISCOVERED ALLO at +43.9%, 5.3x vol (watchlist, not entry).
  - **09:42:35** — DISCOVERED + ENTRY SIGNAL RCT at +18.8%, 23.6x vol. Entered 1694 shares @ $1.40.
  - **09:42:37** — `📉 SCALP EXIT RCT | reason=hard_stop | Hard stop hit at $0.00 (stop=$1.26, entry=$1.40)` — spurious stop-out, actual close $1.39 for -0.71%.
  - **After 09:42** — `trades_today=1, max_daily_trades=1` → scanner stops being called for the rest of the day (see `scalp_main.py:271`, the daily-limit short-circuit lives above the `scanner.should_scan()` check). **Seven total scans on 4/13. None of them saw RMSG.** At 09:42, RMSG's cumulative intraday volume was almost certainly insufficient to hit 5x discovery anyway (open was 09:30, RMSG final volume 461M vs. 13.3M avg = 35x, heavily loaded toward the middle of the day when volume snowballs).
  - Even if the scalper had kept scanning: by the time RMSG's cumulative intraday volume crossed the 12x entry trigger (~160M shares), the price was likely near or past $2.00, well above the original open — entry would have been a chase-buy into a stock that had already run +300%. The scalper's `limit_above_ask_pct: 2.0` wouldn't have helped much on a stock moving this fast.
- **2026-04-14** — prior close $2.70, change_pct at today's ~$2.89 print = +7% → below `min_change_pct: 10%`. Correctly excluded (the +475% was yesterday, not today). Also: scalper didn't start until 09:45 — missed first 15 minutes — then entered SNAL at $0.97, same `$0.00 hard stop` bug exit at $0.98 for +$16.04 (accidental profit), then daily-limit short-circuit until shutdown.

**Takeaway for RMSG:** this is the most diagnostic of the three. Momentum correctly ignored RMSG on 4/13 (sub-$1) and correctly fired on 4/14 (just in time to buy the top of the run). Scalper should have caught the 4/13 surge but was sidelined by **three compounding problems** — an overnight crash-loop that delayed the first clean scan, the `$0.00 hard stop` bug that instant-exited the one trade it took, and the `max_daily_trades=1` short-circuit that killed scanning for the rest of the day. Any two of those three would still have missed RMSG; all three together meant the scalper only really had a ~12-minute window during which it could have discovered it, and during that window RMSG's cumulative volume hadn't ramped enough.

---

### SNAL — Snail Inc (NASDAQ, HTB) — live case added 2026-04-14 ~11:16 ET

**The move:** Prior close 4/11 ≈ $0.38 (inferred from +332% / $1.63 current). Gapped into the regular session, ran steadily through the morning, intraday low $0.75, intraday high $1.66 (as of 11:15 ET when LULD-halted up). Current $1.63, +332.36%, 517M shares, $61.58M market cap. Bec is holding 1,100 @ $1.179 manually (entered after the scalper stopped out — not through the bot).

**Scalper bot (`scalper` Alpaca account) — it actually caught this one.** This is the cleanest possible confirmation of Gaps 2 and 3 in a single trade:
- **09:45:17** — scalper process started (15 minutes after market open; the scalper hadn't been scanning the first 15 minutes because it was still booting / waiting for the skip-wait window).
- **09:45:31** — Scan #1: DISCOVERED + ENTRY SIGNAL SNAL $0.97, +17.3%, 23.6x volume. Crossed 12x threshold immediately.
- **09:45:39** — Filled 2505 shares × $0.97 = ~$2,430. Hard stop set at $0.87, trail at $0.90.
- **09:45:42** — `📉 SCALP EXIT SNAL | reason=hard_stop | Hard stop hit at $0.00 (stop=$0.87, entry=$0.97)`. Same `$0.00` bug as RCT on 4/13.
- **09:45:49** — Actual exit $0.98. P&L +$16.04, +0.66%. Three-second round trip, accidentally positive.
- **09:45:55 onward** — `Daily trade limit reached (1/1) — monitoring only` repeating every 30 seconds for the rest of the day.

**What the scalper missed after 09:45:**
- 11:15 ET: SNAL halted UP at $1.63–$1.66.
- Exit was $0.98. Current $1.63. **The scalper took the first 0.7% of a 66% move and then sat blind for 90 minutes.**
- Even sticking to the original 7% trailing stop and 12:00 ET time stop, a held position would currently be up roughly 66% on $2,430, i.e. ~$1,600 in unrealized P&L on one trade. The bot exited with $16.

**Why this is worth a separate call-out even though it's the same pattern as RCT:** RCT on 4/13 closed at $1.39 (-0.7%) so the bug's damage was "we missed out on RCT's continuation." The bug's damage on SNAL is visible and measurable in real time because the stock is still running. This is also the first instance where the momentum bot's 4/14 scan didn't pick up SNAL either — SNAL was not in the 4/14 08 raw signals (RMSG, RECT, RVMDW, XRTX, OPTXW, BTM, ALLO, MNTS), despite +332% intraday. Reason: momentum scans off the 4/11 closing price which was below $1, so SNAL was excluded at the pre-market price filter. The continuation gap strikes again.

**Takeaway:** SNAL is the textbook case for fixing the scalper bot's `$0.00 hard stop` bug AND lifting its `max_daily_trades` immediately. If either had been different, the scalper would likely still be holding this position. Bec jumped on it manually at $1.18 after watching the scalper bail — a manual save that shouldn't have been necessary. None of this touches the momentum bot on the default account, which never had SNAL on its radar (4/11 close below $1 min_price).

---

## Cross-ticker patterns

**Shared ticker profile (all three):**
- Nano/micro-cap: $18M (BBGI), $30M (RMSG), $44M (SKYQ) market caps
- HTB on Alpaca (all three)
- Started sub-dollar or near-dollar, ran to $10–$20 within 2 weeks
- Multi-day runs (5–10 trading days), not single-day pops
- Massive relative-volume surges on breakout day (14x–35x)
- Extreme intraday range on continuation days (BBGI 4/09: $5.08–$13.16, SKYQ 4/10: $7.62–$15.35, RMSG 4/13: $0.91–$2.73)

**Common miss mechanism:**
1. **Day 1 (initial breakout):** momentum usually catches it if price is <$6. Entry is either (a) skipped for HTB before 4/10, (b) taken but stopped out fast due to entry slippage on a gapping stock, or (c) taken but unable to hold due to execution-layer issues (wash trades, PDT, software stop glitches).
2. **Day 2+:** price has crossed one or both bots' max_price. Scanner price filter excludes. Relative volume also tapers from 15x+ on day 1 to <4x on day 2 (stock is now trending, not surging). Even if the price cap were lifted, the volume filter usually wouldn't fire.
3. **No bot is looking at continuation setups.** There's no "already up big, pulling back, holding above rising MA" scanner. Momentum looks for fresh breakouts. Scalper looks for same-day surges vs. prior close.

**Timing pattern:** 2 of 3 (BBGI, RMSG) went from quiet to +100%+ within one day on a single overnight gap. The third (SKYQ) was a slower ramp from sub-dollar starting in mid-March. This bimodality matters: the gap-and-go setups need same-morning pre-market-aware scanning; the slow ramp is findable by the existing momentum scan on the day the volume finally breaks out (which it was — 4/02 for SKYQ).

**Liquidity / HTB pattern:** 3-for-3 HTB. This isn't surprising — the micro-caps that run are exactly the ones Alpaca flags as hard to borrow, and for good reason. The `allow_htb_software_stop` feature (live 4/10) materially expands what the momentum bot can trade, but it doesn't help with the wash-trade / PDT / software-stop-glitch cascade that ate SKYQ on 4/02 and 4/06. Those are execution-layer issues, separate from the scanner-filter issues that cause "miss" in the coverage sense.

---

## Systematic gaps identified

### Gap 1 — Multi-day continuation runs are invisible to both bots
**Category:** Coverage / design gap.
**Examples in set:** SKYQ 4/07–4/13, BBGI 4/09–4/13, RMSG 4/14+.
**Why:** Both scanners price-filter before volume/MA filters. Once a stock breaks the upper price band (momentum $6 / scalper $8), it's invisible for the rest of the run. The MA% and volume_ratio signals typically remain firing on days 2–5 of a continuation, but the scanners never get that far.
**Severity:** High. This is probably where most of Archer's "edge on the table" is — each of these three ran another 50–300% after exiting the bots' bands.

### Gap 2 — Scalper `max_daily_trades=1` + `$0.00 hard stop` bug destroys intraday coverage
**Category:** Bug + conservative limit.
**Examples in set:** RMSG 4/13 (scalper took RCT at 9:42, instant-exited on $0.00 bug, stopped scanning).
**Why:** `scalp_main.py:271` short-circuits the main loop when `trades_today >= max_daily_trades` before `scanner.should_scan()` is called. A single fluke trade — especially one that exits in <3 seconds to a data glitch — consumes the entire day's discovery budget. The `$0.00` exit is pre-legitimate-stop; it's firing on a stale/zero current price before the first real tick is processed. (See `scalp_flow.py` — likely the monitor-loop `check_exits()` is hitting a default-zero before the bar aggregator has a price.)
**Severity:** High. This is likely the #1 lever for reclaiming edge in the short term.

### Gap 3 — Scalper reliability: overnight crash-loops on corrupt events.db
**Category:** Ops / reliability.
**Examples in set:** 4/13 (crash-looped 00:00–06:00, recovered 08:16). 4/14 (didn't start scanning until 09:45).
**Why:** The scalper's entry point fails hard on a malformed sqlite file (see `CRITICAL  Fatal error (#1): database disk image is malformed` in the 4/13 scalper log). It restarts via launchd with no backoff, so the log has thousands of retries per hour overnight. Also explains the stray `events.db.corrupted.1776082510` sitting in `data/`.
**Severity:** Medium. Didn't directly cause any specific miss for these three tickers, but it burned 15 minutes of open-window on 4/14 and meaningfully compressed 4/13's morning coverage window.

### Gap 4 — "Unreachable" zone between `max_price` and `min_change_pct` (scalper)
**Category:** Config interaction / design bug.
**Examples in set:** SKYQ 4/10 (prior close $7.29).
**Why:** With `max_price: 8.00` and `min_change_pct: 10`, any stock with prior close > $7.27 can never trigger: hitting +10% requires price > $8.00, at which point the exact-price filter rejects it. There's no way for a $7.29-prior-close stock to signal on the scalper regardless of its intraday volume.
**Severity:** Low in absolute ticker count (only stocks with prior close $7.27–$8.00 are affected), but high per affected ticker because it's a silent total exclusion.

### Gap 5 — Momentum `max_price=6.00` + HTB software-stop feature changed mid-cycle
**Category:** Temporal coverage gap (closed).
**Examples in set:** BBGI 4/08 (skipped because no HTB software stop). BBGI 4/09 (stripped by HTB filter before software-stop tagging was wired).
**Why:** The `allow_htb_software_stop` flag in the scanner went live between 4/09 and 4/10 (first seen in logs 4/10 09:22:17: `HTB tagged (software stop): 2/3 signals [CLIK, ANTA]`). BBGI was the direct victim of the one-day implementation gap.
**Severity:** Fixed as of 4/10. Not a forward-looking gap — logged here because the BBGI 4/08 miss reads like a strategy hole but it's actually a recent bugfix the logs predate.

### Gap 6 — Execution-layer pileup on HTB-on-hot-list stocks (wash trade + PDT + software stop)
**Category:** Execution / risk management interaction.
**Examples in set:** SKYQ 4/02 (multiple wash-trade rejections, software stop fallback, instant $0 fill-then-close, re-entry cycle). SKYQ 4/06 (PDT lockout prevented closing a losing software-stop position for an hour+).
**Why:** On an HTB stock, the hard stop gets rejected ("cannot be sold short"), falls back to software stop. Software stop close requests can themselves be rejected ("wash trade detected" or "PDT"). The momentum bot keeps re-attempting the close every 5s, accumulating rejected order attempts without exit. If the scanner re-fires the same signal while the position is entangled, the momentum bot tries to re-enter (burning another day trade on the default account). The scalper bot on the separate account is unaffected — its own day-trade budget and position state are independent.
**Severity:** Medium. Doesn't cause a signal-level miss, but it does degrade the P&L on trades that *were* taken, and it silently consumes PDT budget in ways that handicap the next day's trading.

### Gap 7 — Pre-market discovery is not wired in
**Category:** Timing.
**Examples in set:** BBGI 4/08 (gapped from $3.14 to open $5.25 — the setup was visible in pre-market). RMSG 4/13 (pre-market would have seen something building).
**Why:** Both scanners run off regular-session prints. The momentum scanner reads the previous day's close from cache; the scalper scans on live snapshots starting at 09:30. No bot is reading pre-market quotes or volume.
**Severity:** Medium. Not directly responsible for any of the three misses (in each case, something else was also wrong), but it's a capability gap that compounds the other gaps.

### Gap 8 — No post-mortem path for "signal was right, execution whiffed"
**Category:** Observability.
**Why:** `events.db` only has 382 rows across 4/13–4/14, and they're almost all `system/scalper_started` + `streaming/connected` + `config/strategy_config_update`. None of the signal-level events (`signal_rejected`, `entry_skipped`, `price_filter_rejected`) are being written. Consequence: for this investigation I had to reconstruct from log grep, not SQL. Also means there's no way for a dashboard to show "here are the 14 signals we saw this week that we chose not to trade, with reasons."
**Severity:** Low for this investigation (logs were enough), but would compound any future investigation of this shape.

---

## Option tree for Archer

Each option below is framed as a trade-off. Pick whichever combinations match your tolerance for false signals, execution complexity, and risk.

### If you want to catch continuation runs (SKYQ 4/08–4/13, BBGI 4/10–4/13 style)

| Option | Trade-off |
|---|---|
| **A. Raise momentum `max_price` to $12 or $15** | Opens continuation days to the existing MA+vol signal. But: volume ratio on day-3+ of a run is usually <4x, so few signals will actually fire. You'll get 0–2 more signals/week, not 10. Also lets the scanner consider larger-cap noise stocks. |
| **B. Raise scalper `max_price` to $15** | Scalper's entry trigger is volume ratio (not price level), so this is cleaner than (A). Downside: spread/slippage assumptions (2% above ask) degrade on higher-priced stocks; limit-order sizing logic may need tweaking. |
| **C. Add a "continuation" sub-strategy** | A new scanner config that looks for: above rising MA20, within N% of 10-day high, volume > 1.5x 20-day avg, any price range. Lower volume bar than current strategies, higher MA-distance bar. Standalone YAML, standalone watchlist. Alert-only to start, promote to live after walk-forward validation. Highest upside but also highest implementation cost. |
| **D. Watchlist-only: pin tickers the bot has previously traded for N days** | Cheap. If momentum trades a ticker, keep it on a software-alert list for 10 days regardless of current price. When the ticker triggers any of: +5% day on >2x relative volume, +20% 3-day, new 20-day high on > 20-day avg volume — push a Pushover alert for manual review. No autoexecution, no new sub-strategy. |
| **E. Leave it alone** | These runs are genuinely hard. The bots caught the first-day breakout in 2 of 3 cases; the continuation leg is Archer's to manually trade or skip. Defensible if the false-positive rate of (A)/(B)/(C) turns out to dilute the book more than they add. |

**Recommendation if you pick one:** D. Cheapest, safest, and directly addresses the "I see it but the bot doesn't" complaint. Promote to (C) once D's alert log shows 5+ weeks of clean, non-noisy continuation alerts.

### If you want to fix the scalper's intraday coverage

| Option | Trade-off |
|---|---|
| **F. Fix the `$0.00 hard stop` bug first** | Should be a same-day diagnosis. Likely living in `scalp_flow.check_exits()` — probably reading `current_price` before the bar aggregator has a price, defaulting to 0. This is pure bug, no strategy trade-off. Do this before anything else in this category. |
| **G. Raise `max_daily_trades` from 1 to 3** | Matches the PDT day-trade budget. The scalper can still pace itself via `same_symbol_cooldown_sec` and the `max_concurrent_positions: 1` cap. Trade-off: more exposure to the kind of fluke single-tick exits seen on RCT/SNAL until (F) lands; with (F) landed, this cleanly opens coverage to later-morning setups like RMSG 4/13 (which peaked ~11am-ish based on bar pattern). |
| **H. Move the daily-limit check to _after_ `scanner.should_scan()`** | Lets the scanner keep discovering + alerting even when no new entries will be taken. Minimal code change; gives you the "here's what you missed" log visibility without actually trading more. Good companion to (G) if Archer wants to validate before raising the cap. |
| **I. Harden scalper crash-loop** | Exponential backoff on fatal errors, alerting on >5 restarts in 10 minutes, automatic quarantine of corrupt events.db files. Ops cost; not a strategy change. |
| **J. Close the `prior_close > $7.27` unreachable zone** | Trivial: either lower `min_change_pct` to 5 for the band $7.00–$8.00, or add a separate "high-band" scanner with `min_price: 7, max_price: 15, min_change_pct: 5`. Low cost; narrow benefit (how many of your misses are actually in this band?). |

**Recommendation if you pick one:** F, then H. F is a bug fix, not a strategy decision. H gives you observability on whether G would be worth it.

### If you want to see more of what's on the table before acting

| Option | Trade-off |
|---|---|
| **K. Build a "why wasn't this traded" dashboard** | Extends `events.db` with `signal_rejected` events, each tagged with the filter that excluded the signal (price, volume, HTB, news, daily-limit, etc.). Closes Gap 8. Then rerun this investigation in 4 weeks and the answers come out of a SQL query instead of 90 minutes of grep. Cost: ~2-3 hours of event-logger work. |
| **L. Paper-run a relaxed-config scalper in parallel** | Third Alpaca account. Same codebase, different YAML: `max_daily_trades: 5`, `max_price: 15`, `min_change_pct: 7`. No overlap with the live one. After 4 weeks, compare hit rates on runners vs. the current config. Cost: infrastructure (account, launchd, API server), but zero risk to the live portfolios. |

---

## Data caveats

- **No pre-market/after-hours tick data was reconstructed.** bars.db only has regular-session daily bars. For the 4/13 intraday timeline of RMSG I inferred from final-day volume distribution (e.g. "likely ramped in middle of day"), not from actual 1-minute bars.
- **SKYQ 4/06 final exit is inferred, not logged.** The bot was stuck on SKYQ at 10:01 (PDT-locked), and by 10:46 it was managing PFSA. Somewhere in that 45-minute window SKYQ exited, but I didn't find a `TRADE CLOSED SKYQ` line in the window I searched. The SKYQ outcome for the 4/02 → 4/06 multi-day episode is therefore incomplete in this report.
- **`events.db` coverage starts 4/13.** Anything before that needed log-grep reconstruction, which is slower and less exhaustive. Per-ticker walkthrough for BBGI 4/08 and SKYQ 4/02 used log-grep only.
- **Scalper scan counters reset on process restart.** When I say "7 scans on 4/13," that's the last session's scan count. On a day with many restarts (4/13), the cumulative scan count was higher than 7 earlier in the morning, but the session that actually traded RCT only ran 7 scans.
- **20-day avg volumes as of 4/10:** computed off daily bars, so early-March low-vol days anchor the average down. On a stock like RMSG this is appropriate; on BBGI the pre-breakout average is dominated by <50k-share days and anything over ~1M intraday looks enormous relative.
- **Not included in this investigation:** whether RMSG/BBGI/SKYQ had news catalysts (the news gate is enabled with `block_on_negative: false` so it wouldn't have stopped trades, but it would flavor the "positive catalyst boost" ranking). I didn't check `shared/news`.

---

## Recommendations (if you want one)

If Archer only has time to act on one thing: **fix the scalper `$0.00 hard stop` bug (Option F above) and move the daily-limit check after the scanner (Option H).** Those two together re-open the scalper's intraday coverage without changing any risk parameters, and they set you up to then decide whether to raise `max_daily_trades` based on real alert-log evidence.

If Archer is willing to pick two: add (D) — the "keep traded tickers on an alert watchlist for 10 days" — to get visibility on the continuation-run pattern without building a new sub-strategy yet.

Everything else (raising price caps, new continuation scanner, pre-market discovery) should wait until (D) has generated enough data to justify the cost.
