# ArcherStocks: How It Compares & How It Could Improve

*Analysis report — April 7, 2026*
*Cross-referenced against: "Why Trading Bots Succeed or Fail," "Successful Trading Bot Strategies," and "Small-Cap Short-Hold Trading Strategies" research reports*

---

## TL;DR

ArcherStocks gets a surprising amount right compared to what the research says separates the 10% of bots that make money from the 90% that don't. The core strategy thesis (small-cap momentum breakout + volume confirmation + asymmetric risk/reward) has genuine academic backing. The operational infrastructure (kill switch, heartbeat monitoring, crash recovery, PDT protection) is legitimately better than what most retail algo traders build. Where it falls short is in the areas the research identifies as the difference between "good strategy" and "robust system": no market regime awareness, full-position concentration, a backtester that doesn't model slippage or survivorship bias, and a trailing stop that's arguably too tight for the assets it trades. Every gap identified below has a specific, research-backed fix.

---

## Part 1: What ArcherStocks Gets Right

### ✅ The Strategy Has a Real Edge

**What the research says:** Momentum is "the premier market anomaly" (Fama, 2008). It's amplified in small caps due to gradual information diffusion. Volume confirmation adds genuine predictive power — breakouts with high volume are significantly more likely to sustain.

**What ArcherStocks does:** MA crossover + 12x volume filter + price range $1.22–$10.09. The bot is scanning for exactly the pattern the research validates: a decisive move above a trend indicator, confirmed by outsized volume, in a universe where momentum effects are strongest.

**Verdict:** The core thesis is sound. This isn't curve-fitting random patterns — it's implementing a well-documented anomaly in the asset class where it's most pronounced.

### ✅ Asymmetric Risk/Reward Is Mathematically Robust

**What the research says:** With a 3:1 risk-to-reward ratio, you need only a 25% win rate to break even. Paul Tudor Jones targets 5:1 and considers 20% acceptable. The key is capped downside with uncapped upside.

**What ArcherStocks does:** 6% hard stop (capped downside), 4.5% trailing stop that lets winners run, breakeven trigger at +5%. The backtest showed 45.3% win rate with +31.99% average winners vs -4.79% average losers — a 6.7:1 reward-to-risk ratio, profit factor of 5.53.

**Verdict:** This is textbook asymmetric trading. The math works even if the win rate drops significantly from backtest levels. The strategy can be wrong on most trades and still be profitable.

### ✅ Operational Infrastructure Is Above Average

**What the research says:** Most catastrophic bot losses come from poor monitoring, not bad market reads. No circuit breakers, no alerting, no kill switch. Knight Capital lost $440M in 45 minutes because nobody was watching.

**What ArcherStocks does:**

- Kill switch (file-based, checked every loop iteration)
- Healthchecks.io heartbeat (pings every 60s, alerts after 5 min silence)
- Pushover alerts at every state change (entry, stop hit, errors, PDT blocks)
- Crash recovery (atomic state persistence, orphaned position detection on restart)
- Wash trade protection (pre-flight order cleanup)
- HTB fallback stops (server-side → DAY → software stop cascade)
- Market hours enforcement with holiday detection
- PDT guard with rolling 5-day window
- Strategy hot-reload without restart
- iOS companion app for remote kill switch and monitoring

This is legitimately more operational infrastructure than the vast majority of retail algo trading setups. The "nobody's watching" failure mode is well covered.

### ✅ Two-Phase Backtester with Intraday Precision

**What the research says:** 60% of retail traders skip proper historical validation. Backtests that use only daily bars miss intraday dynamics critical to short-hold strategies.

**What ArcherStocks does:** Phase 1 scans on daily bars (fast), Phase 2 simulates on 5-minute bars (precise). Entries use next-day open prices. Stops trigger on intraday bar lows. Time stops close at EOD. The backtester correctly handles timezone conversion, PDT counting, and produces trade-by-trade journals with timestamps.

**Verdict:** The two-phase approach is smart — daily scanning for speed, intraday simulation for realism. This is better than most retail backtesting setups.

### ✅ Human Oversight Model

**What the research says:** The most successful traders use bots as tools to execute a human-directed strategy, not as autonomous money printers.

**What ArcherStocks does:** The iOS app provides real-time visibility and control. Strategy changes go through the human (YAML config). The bot doesn't self-optimize or change its own parameters. Kill switch is one tap. Paper trading phase validates before live capital.

**Verdict:** This is the right model. The bot executes; the human supervises and decides when conditions warrant changes.

---

## Part 2: Where ArcherStocks Falls Short

### ❌ No Market Regime Filter — The Biggest Gap

**What the research says:** Momentum strategies only work in bullish conditions. Bear markets are negative autocorrelation regimes where momentum gets destroyed. Daniel and Moskowitz's NBER paper documents that momentum portfolios crash specifically during bear market recoveries. A dynamic strategy that switches between momentum and contrarian approaches achieves the highest Sharpe ratio.

**What ArcherStocks does:** Nothing. No VIX check, no SPY trend filter, no breadth indicator, no volatility regime detection. The bot will happily scan for momentum breakouts during a market crash and take every signal.

**Impact:** This is the single highest-risk gap. The entire backtest period (2025–2026) has been favorable for small-cap momentum. The strategy has never been tested through — or protected against — a regime where its edge disappears. In a bear market, the bot would likely take a series of rapid losses as breakouts fail in quick succession, and the YOLO sizing means each one hits the full account.

**Research-backed fix:** Add a market regime gate. Simplest version: only allow entries when SPY is above its 200-day MA. More sophisticated: use VIX levels (e.g., pause entries when VIX > 30) or market breadth (advance/decline ratio). This is the highest-impact improvement by far.

### ❌ YOLO Position Sizing — Research Says This Is Too Aggressive

**What the research says:** The Kelly Criterion is the gold standard for optimal bet sizing. Even full Kelly produces stomach-churning drawdowns. Practitioners universally recommend half-Kelly or less. Fractional Kelly reduces volatility more than it proportionally reduces expected growth.

**What ArcherStocks does:** 100% of equity in a single position. `mode: yolo`. No Kelly calculation, no fractional sizing, no risk-based sizing.

**Impact:** The backtest's 34.9% max drawdown is a direct result of this. With full concentration, a single gap-down through the stop (which the backtester doesn't model) could produce a 20–30% account hit in one trade. Over time, the Law of Large Numbers means this *will* happen.

**Research-backed fix:** Implement Kelly or half-Kelly sizing. With the backtest's 45.3% win rate, +31.99% avg win, -4.79% avg loss:

```
Kelly % = W - [(1-W) / R]
       = 0.453 - [(1-0.453) / (31.99/4.79)]
       = 0.453 - [0.547 / 6.68]
       = 0.453 - 0.082
       = 0.371 (37.1% of account per trade)
```

Half-Kelly = ~18.5% of account per trade. This is dramatically less aggressive than 100%, but the research says it produces a smoother equity curve with only modest return reduction — and it opens the door to running multiple concurrent positions for diversification.

### ❌ Backtester Doesn't Model Key Friction

**What the research says:** Slippage averages 0.1–0.6% per trade on liquid names but 2–5% on small caps. Bid-ask spreads on penny stocks run 4–8%. Survivorship bias inflates small-cap returns by ~5% annually. ~44% of published strategies fail to replicate on new data. A strategy showing 15% annual returns with survivorship bias might actually deliver 8%.

**What ArcherStocks does:** The backtester assumes:
- Entry fills at exact open price (no slippage)
- Stops fill at exact stop price (no gap-through)
- No bid-ask spread modeling
- No commission (Alpaca is $0, so this is fine)
- No survivorship bias handling (scans only currently-listed stocks)
- No liquidity impact (assumes infinite liquidity)

**Impact:** The backtest results are almost certainly overstated. On $1–$10 stocks with volume surges, getting filled at the open can easily cost 1–3% in slippage when everyone else sees the same signal. Stops can gap through overnight. Stocks that would have triggered the scanner but subsequently delisted (taking your capital with them) aren't in the data.

The QuantifiedStrategies backtests that turned $100K → $3.6M used only 0.03% slippage per trade. That's for S&P 500 stocks. Your universe is 50–100x less liquid.

**Research-backed fixes:**
1. Add slippage modeling: 0.5–1.0% per trade for your universe would be conservative
2. Add gap-through modeling: if next-day open < stop price, fill at open (not stop)
3. Use point-in-time data that includes delisted securities (Alpaca may not provide this — check if their historical bars include delisted symbols)
4. Run the backtest with these friction costs and compare: if the strategy is still profitable, that's real. If the +7,907% drops to +200%, you know how much was friction-free fantasy.

### ❌ Trailing Stop May Be Too Tight

**What the research says:** A study testing trailing stops from 5% to 55% found the highest cumulative return with a 15% trail and the highest average quarterly return with a 20% trail. 5% and 10% trails trigger too frequently during normal volatility. For volatile assets, an ATR-based trailing stop adapts to actual price behavior.

**What ArcherStocks does:** 4.5% trailing stop from the high water mark. On stocks that regularly move 5–7%+ intraday, this means the trailing stop can trigger during normal consolidation within a larger move — shaking you out of a trade that was working.

**Impact:** The backtest shows 29.7% of trades exit via trailing stop (avg +38.5%), which sounds good — but we can't see how many of those were premature exits on trades that would have run further with a wider trail. The 20.3% time-stop exits (where the trade didn't hit the trail *or* the hard stop) suggest some trades are just chopping around without enough room to breathe.

**Research-backed fix:** Test a volatility-adjusted trailing stop (2x ATR instead of fixed 4.5%). This would automatically give wider room to volatile names and tighter room to calmer ones. Alternatively, test 8–10% fixed trail and compare results.

### ❌ Single-Year Backtest in a Favorable Regime

**What the research says:** Small-cap backtests on a single year are particularly vulnerable to period-specific artifacts. Momentum strategies thrive in risk-on environments and die in risk-off. The most reliable validation uses diverse datasets across multiple market regimes.

**What ArcherStocks does:** The primary backtests cover 2025 and early 2026 — a generally favorable period for small-cap momentum. No bear market period tested. No out-of-sample validation on a held-out time window.

**Impact:** The +7,907% headline number is from a single year that included CTEC (+396.2%) as a massive outlier. Remove the top 3 trades and the strategy is still profitable, but the return profile changes dramatically. Without testing through a 2022-style drawdown, a COVID crash, or a rate shock, we don't know how the strategy behaves when its core edge disappears.

**Research-backed fix:** Run the backtester on:
- 2022 (aggressive rate hikes, small-cap drawdown)
- 2020 March (COVID crash + recovery — momentum crash then reversal)
- 2018 Q4 (VIX spike, small-cap weakness)
- If Alpaca historical data goes back far enough, any period with sustained small-cap underperformance

If the strategy survives (even with reduced returns), it's real. If it blows up, the regime filter becomes non-negotiable.

### ⚠️ No Slippage Protection on Entry

**What the research says:** Institutional HFT executes in nanoseconds. Retail setups are 100x+ slower. By the time a retail bot reacts to a price movement, the opportunity may be gone. VWAP/TWAP execution algorithms exist specifically to reduce market impact.

**What ArcherStocks does:** Market buy orders. No limit price, no VWAP execution, no slippage budget. The bot calculates shares from the snapshot price, submits a market order, and waits for fill.

**Impact:** On a $3 stock gapping up at open with 12x average volume, a market order competes with every other scanner that caught the same signal. The fill price could easily be 2–5% above the snapshot, and that slippage comes directly out of profit margin.

**Research-backed fix:** Use aggressive limit orders (e.g., snapshot price + 1% max) instead of market orders. If the stock runs past your limit, you miss the trade — but missing a trade is always better than overpaying for one. This is a simple change with meaningful impact on execution quality.

---

## Part 3: How ArcherStocks Compares to the Research Playbook

| Research Finding | ArcherStocks Status | Grade |
|---|---|---|
| Genuine statistical edge | ✅ Momentum + volume on small caps | A |
| Rigorous backtesting | ⚠️ Good mechanics, missing friction modeling | B- |
| Out-of-sample validation | ❌ Single favorable year only | D |
| Risk management (position level) | ✅ Hard stop + trailing + time stop + breakeven | A- |
| Risk management (portfolio level) | ❌ No regime filter, no drawdown limits | F |
| Position sizing | ❌ YOLO (100% concentration) | F |
| Human oversight | ✅ iOS app, kill switch, alerts | A |
| Monitoring & alerting | ✅ Heartbeat, Pushover, crash recovery | A |
| Execution quality | ⚠️ Market orders, no slippage protection | C |
| Adaptation to market conditions | ❌ No regime awareness | F |
| Multi-strategy diversification | ❌ Single strategy, single position | D |
| Survivorship bias handling | ❌ Not modeled | F |

**Overall: The strategy and operational infrastructure are strong (A-tier). The risk management, position sizing, and validation are the weak links (D/F-tier).**

---

## Part 4: Prioritized Improvement Roadmap

Ranked by impact-to-effort ratio, grounded in the research findings:

### Tier 1: Do These First (High Impact, Moderate Effort)

**1. Market Regime Filter**
- *Why:* Single highest-impact risk reduction. Momentum crashes are well-documented and devastating.
- *What:* Gate entries on SPY > 200-day MA, or VIX < 30, or both.
- *Effort:* Low — one new guardrail check before entry.
- *Research basis:* Daniel & Moskowitz (NBER), Morningstar momentum turning points, century of trend-following evidence.

**2. Half-Kelly Position Sizing**
- *Why:* Reduces max drawdown by ~50% with modest return reduction. Enables future multi-position diversification.
- *What:* Calculate Kelly fraction from rolling win rate and avg win/loss. Use half-Kelly as position size.
- *Effort:* Medium — new sizing mode in order_flow.py, rolling performance tracker.
- *Research basis:* QuantStart Kelly Criterion, Frontiers in Applied Mathematics (fractional Kelly), universal practitioner consensus.

**3. Limit Orders for Entry**
- *Why:* Prevents overpaying on volatile opens. Simple, immediate execution quality improvement.
- *What:* Replace market buys with aggressive limits (snapshot + 1–2% max).
- *Effort:* Low — change order type, add limit price calculation.
- *Research basis:* Retail vs institutional execution gap research, VWAP/TWAP literature.

### Tier 2: Do These Next (High Impact, Higher Effort)

**4. Backtester Friction Modeling**
- *Why:* Current results are almost certainly overstated. Need realistic numbers to trust the strategy.
- *What:* Add configurable slippage (0.5–1.0%), gap-through modeling (fill at open if open < stop), spread cost.
- *Effort:* Medium — modify backtester fill logic, add config params.
- *Research basis:* Carhart (1997) momentum after costs, Accountend small-cap slippage data.

**5. Multi-Year Backtest Including Bear Markets**
- *Why:* Single-year validation is the #1 reason strategies fail live (44% fail to replicate).
- *What:* Run on 2018, 2020, 2022 data. Compare results with and without regime filter.
- *Effort:* Medium — depends on Alpaca historical data availability.
- *Research basis:* Bailey et al. Probability of Backtest Overfitting, ScienceDirect overfitting research.

**6. Max Drawdown Circuit Breaker**
- *Why:* The bot currently has no account-level loss limit. A string of losses in a regime shift compounds unchecked.
- *What:* If account drops X% from high water mark (e.g., 15%), pause entries for N days or until manual override.
- *Effort:* Low — new guardrail check against account equity history.
- *Research basis:* Every institutional risk management framework; "the ones that work" section of Report #1.

### Tier 3: Do When Ready (Medium Impact, Variable Effort)

**7. ATR-Based Trailing Stop**
- *Why:* Fixed 4.5% trail is likely too tight for small-cap volatility. ATR adapts per-stock.
- *What:* Trail at 2x ATR(14) below high water mark instead of fixed %.
- *Effort:* Medium — need ATR calculation in monitor loop, per-position ATR tracking.
- *Research basis:* Quant Investing trailing stop studies, volatility-adjusted stop literature.

**8. Survivorship Bias Check**
- *Why:* Backtest likely overstates returns by ~5% annually due to missing delisted stocks.
- *What:* Verify whether Alpaca includes delisted symbols in historical data. If not, supplement with a survivorship-free dataset for validation.
- *Effort:* Medium-High — may need external data source.
- *Research basis:* SSRN survivorship bias study (4.94% annual overstatement), AlphaArchitect delistings research.

**9. Multi-Strategy / Multi-Position**
- *Why:* QuantifiedStrategies showed 5 complementary strategies produced $100K → $3.6M with only 2 losing years. Single-strategy has regime risk.
- *What:* The orchestrator is already spec'd — build it. Even adding one complementary strategy (e.g., a mean-reversion signal for choppy markets) would diversify regime exposure.
- *Effort:* High — the plumbing exists but the orchestrator isn't built yet.
- *Research basis:* Multi-strategy portfolio research, regime-dependent strategy switching.

---

## Bottom Line

ArcherStocks is doing a lot of things right that most retail bots get wrong — the operational infrastructure is genuinely impressive, and the core strategy is backed by decades of academic evidence. It's not one of the 90% of bots that fail because someone bought a YouTube guru's "AI money printer."

But the research is clear on what separates a good strategy from a robust system: **regime awareness, position sizing discipline, realistic friction modeling, and multi-period validation.** These are the areas where ArcherStocks has the most room to grow, and every fix has well-documented research behind it.

The good news: none of these gaps require rethinking the strategy. They're all about **wrapping the existing edge in better risk management** — which is exactly what the literature says the successful 10% do differently.
