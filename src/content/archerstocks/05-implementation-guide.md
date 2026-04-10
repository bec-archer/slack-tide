# ArcherStocks: Implementation Guide for Improvements

*For a fresh Claude session — April 7, 2026*

---

## What This Document Is

This is a step-by-step implementation guide for improving the ArcherStocks trading bot based on extensive research into why trading bots succeed or fail, what strategies work, and how this specific bot compares. A fresh Claude should be able to pick up any of these tasks and implement them with the context provided here.

**Do these in order.** They're ranked by impact-to-effort ratio.

**Reference material** (all in the workspace folder):
- `Trading Bot Success and Failure Report.md` — why 90% of bots lose money
- `Successful Trading Bot Strategies Report.md` — what the winning 10% do
- `Small-Cap Short-Hold Trading Strategies Report.md` — research specific to this strategy type
- `ArcherStocks - How It Compares and How It Could Improve.md` — gap analysis with grades

---

## Project Architecture Quick Reference

```
ArcherStocks/
├── bot/
│   ├── main.py              # Trading loop: scan → enter → monitor → exit
│   ├── scanner.py           # Signal detection and ranking
│   ├── order_flow.py        # Position sizing, entry, stop management, exits
│   ├── guardrails.py        # Safety checks (kill switch, hours, PDT, limits)
│   ├── streaming.py         # WebSocket price feed (optional enhancement)
│   └── data_cache.py        # SQLite cache for daily bars
├── config/
│   └── strategies/
│       └── ma20_momentum.yaml   # All strategy parameters (thresholds, stops, sizing)
├── state/
│   └── active_trade.json    # Current position state (persists across restarts)
├── logs/
│   └── trade_journal.json   # Trade history (entries, exits, reasons)
├── MomentumBacktester/
│   └── backtest_momentum_breakout.py  # Two-phase backtester (daily + intraday)
└── Docs/
    └── ArcherStocks_System_Spec.md
```

**Key data flow:** `main.py` orchestrates everything. It calls `scanner.py` to find signals, `guardrails.py` to check safety, `order_flow.py` to enter/manage/exit positions, and loops on a 60s (REST) or 5s (WebSocket) interval monitoring the active trade.

**Config is YAML-driven.** Strategy parameters live in `config/strategies/ma20_momentum.yaml` and are hot-reloadable without restart. New features should add their config to this file.

---

## Fix #1: Market Regime Filter

**Priority:** 🔴 Critical — do this first
**Effort:** Low
**Why:** Momentum strategies get destroyed in bear markets. Daniel & Moskowitz (NBER) showed momentum crashes happen specifically during bear market *recoveries* — past losers rebound while past winners collapse. The bot currently has zero protection against this.

### What to Build

A guardrail that blocks new entries when the broad market is in a risk-off regime. Two signals, either sufficient to block:
1. **SPY below its 200-day moving average** — classic trend filter
2. **VIX above a threshold** (suggest 25–30) — volatility regime filter

### Where It Goes

**Config addition** — `config/strategies/ma20_momentum.yaml`:
```yaml
regime:
  enabled: true
  spy_ma_period: 200
  spy_must_be_above_ma: true
  vix_max: 30.0
```

**Implementation** — `bot/guardrails.py`:

Add a new method to the `Guardrails` class:
```python
def is_regime_favorable(self) -> tuple[bool, str]:
    """Check if broad market regime supports momentum entries."""
    if not self.config.get("regime", {}).get("enabled", False):
        return True, ""
    
    # Check SPY vs 200-day MA
    spy_bars = self._get_daily_bars("SPY", days=210)
    spy_close = spy_bars[-1].close
    spy_ma200 = sum(b.close for b in spy_bars[-200:]) / 200
    if spy_close < spy_ma200:
        return False, f"SPY ({spy_close:.2f}) below 200-day MA ({spy_ma200:.2f})"
    
    # Check VIX level
    vix_snapshot = self._get_snapshot("VIX")  # or ^VIX depending on feed
    vix_level = vix_snapshot.latest_trade.price
    vix_max = self.config["regime"].get("vix_max", 30.0)
    if vix_level > vix_max:
        return False, f"VIX ({vix_level:.1f}) above threshold ({vix_max})"
    
    return True, ""
```

**Integration** — `bot/main.py`:

Insert the check after scanning but before entry (around line 319, between Phase 2 and Phase 4):
```python
# After scanner returns top signal, before entering...
regime_ok, regime_reason = guardrails.is_regime_favorable()
if not regime_ok:
    logger.warning(f"Regime filter blocked entry: {regime_reason}")
    notify.send(f"⚠️ Regime filter: {regime_reason} — skipping entry", priority=-1)
    continue  # Skip to next day
```

### Data Source Notes

- SPY daily bars: Use the existing `data_cache.py` infrastructure — SPY will already be in the cache if you add it to the symbol universe, or fetch it separately via `alpaca.get_bars("SPY", ...)`.
- VIX: Alpaca may not provide VIX directly. Check if `^VIX` or `VIXY` (VIX ETF) is available. If not, use `UVXY` as a proxy, or hit a free API (Yahoo Finance) for the VIX level. An alternative is to skip VIX entirely and use SPY-only for v1.
- Cache the regime check daily — no need to re-fetch every loop iteration.

### Backtester Support

Add the same regime filter to `backtest_momentum_breakout.py` so you can compare results with and without it. In `simulate_trade()`, before entering, check if SPY was above its 200-day MA on the signal date. This requires fetching SPY bars alongside the stock bars.

### Verification

- Run the backtester on 2025 data with and without the regime filter. Compare trade count, win rate, and max drawdown.
- If Alpaca has data going back to 2022, run a backtest covering the 2022 rate-hike period (SPY spent months below 200-day MA) to see how many losing trades the filter would have blocked.

---

## Fix #2: Half-Kelly Position Sizing

**Priority:** 🔴 Critical
**Effort:** Medium
**Why:** The bot currently puts 100% of equity into a single position (`mode: yolo`). The Kelly Criterion — the mathematical optimum for position sizing — says ~37% is optimal for this strategy's win rate and payoff ratio. Practitioners use half-Kelly (~18.5%) to reduce drawdown volatility. This change alone would roughly halve the max drawdown while modestly reducing returns.

### The Math

```
Kelly % = W - [(1-W) / R]
Where:
  W = win rate = 0.453
  R = avg_win / avg_loss = 31.99 / 4.79 = 6.68

Kelly = 0.453 - (0.547 / 6.68) = 0.371 → 37.1%
Half-Kelly = 18.5%
```

### What to Build

A new sizing mode that calculates position size from rolling trade performance instead of "use everything."

### Where It Goes

**Config addition** — `config/strategies/ma20_momentum.yaml`:
```yaml
sizing:
  mode: kelly            # "yolo" (current), "kelly", "half_kelly", "quarter_kelly", "fixed_pct"
  kelly_lookback: 20     # Calculate win rate / avg W/L over last N trades
  kelly_fraction: 0.5    # 0.5 = half-Kelly, 1.0 = full Kelly
  max_position_pct: 50.0 # Never exceed this % of equity regardless of Kelly
  min_position_pct: 5.0  # Floor — don't bother with tiny positions
  max_concurrent_positions: 1
```

**Implementation** — `bot/order_flow.py`:

Replace the sizing block (around lines 180–189) with a method:

```python
def _calculate_position_size(self, equity: float, buying_power: float) -> float:
    """Calculate position size based on configured sizing mode."""
    mode = self.config["sizing"].get("mode", "yolo")
    available = min(equity, buying_power) * 0.995  # fee buffer
    
    if mode == "yolo":
        return available
    
    if mode in ("kelly", "half_kelly", "quarter_kelly"):
        fraction = {"kelly": 1.0, "half_kelly": 0.5, "quarter_kelly": 0.25}[mode]
        # Override fraction if explicitly set in config
        fraction = self.config["sizing"].get("kelly_fraction", fraction)
        
        kelly_pct = self._calculate_kelly_fraction()
        position_pct = kelly_pct * fraction
        
        # Apply floor and ceiling
        max_pct = self.config["sizing"].get("max_position_pct", 100.0) / 100
        min_pct = self.config["sizing"].get("min_position_pct", 5.0) / 100
        position_pct = max(min_pct, min(position_pct, max_pct))
        
        return available * position_pct
    
    if mode == "fixed_pct":
        pct = self.config["sizing"].get("max_position_pct", 25.0) / 100
        return available * pct
    
    return available  # fallback to yolo


def _calculate_kelly_fraction(self) -> float:
    """Calculate Kelly % from rolling trade history."""
    lookback = self.config["sizing"].get("kelly_lookback", 20)
    trades = self._load_recent_trades(lookback)
    
    if len(trades) < 10:
        # Not enough data — use conservative default
        return 0.10  # 10% until we have history
    
    wins = [t for t in trades if t["return_pct"] > 0]
    losses = [t for t in trades if t["return_pct"] <= 0]
    
    if not losses:
        return 0.25  # Cap if no losses yet (suspicious)
    
    win_rate = len(wins) / len(trades)
    avg_win = sum(t["return_pct"] for t in wins) / len(wins) if wins else 0
    avg_loss = abs(sum(t["return_pct"] for t in losses) / len(losses))
    
    if avg_loss == 0:
        return 0.25
    
    R = avg_win / avg_loss
    kelly = win_rate - ((1 - win_rate) / R)
    
    return max(0.0, kelly)  # Never negative
```

**Data source for rolling trades:** Read from `logs/trade_journal.json`, which already records every trade with entry/exit prices and return percentages. The `_load_recent_trades()` helper just needs to parse the last N completed trades from this file.

### Cold Start Problem

When the bot first runs (or switches strategies), there's no trade history to calculate Kelly from. The `_calculate_kelly_fraction()` method handles this by returning a conservative 10% until at least 10 trades are recorded. This is intentionally cautious — better to undersize early than to YOLO on insufficient data.

### Backtester Support

Add Kelly sizing to the backtester. Track a rolling window of simulated trades and recalculate Kelly after each one. This will show the realistic equity curve with adaptive sizing rather than the fixed-100% curve.

### Verification

- Run the backtester on 2025 data with `mode: half_kelly` and compare to `mode: yolo`.
- Key metrics to compare: max drawdown (should roughly halve), final equity (will be lower but still positive), Sharpe ratio (should improve due to lower volatility).

---

## Fix #3: Limit Orders for Entry

**Priority:** 🟡 High
**Effort:** Low
**Why:** The bot currently uses market buy orders. On a $3 small-cap stock gapping up at open with 12x volume, a market order competes with every other scanner that caught the same signal. The fill can easily be 2–5% above the snapshot price.

### What to Build

Replace market buys with aggressive limit orders that cap the maximum entry price.

### Where It Goes

**Config addition** — `config/strategies/ma20_momentum.yaml`:
```yaml
execution:
  order_type: limit        # "market" (current) or "limit"
  limit_slippage_pct: 2.0  # Max % above snapshot price for limit
  limit_timeout_sec: 120   # Cancel unfilled limit after N seconds
```

**Implementation** — `bot/order_flow.py`:

In `enter_position()`, around lines 233–241 where the market buy is placed:

```python
order_type = self.config.get("execution", {}).get("order_type", "market")

if order_type == "limit":
    slippage_pct = self.config["execution"].get("limit_slippage_pct", 2.0)
    limit_price = round(current_price * (1 + slippage_pct / 100), 2)
    order = self.alpaca.submit_order(
        symbol=symbol,
        qty=shares,
        side="buy",
        type="limit",
        time_in_force="day",
        limit_price=limit_price,
    )
    logger.info(f"Limit buy {shares} {symbol} @ {limit_price} (snapshot: {current_price})")
else:
    order = self.alpaca.submit_order(
        symbol=symbol,
        qty=shares,
        side="buy",
        type="market",
        time_in_force="day",
    )
```

**Timeout handling:** The existing `wait_for_fill()` logic (lines 243–340) already has a timeout. If the limit doesn't fill within the timeout, cancel the order and move on. Add a cancel call:

```python
if not filled_within_timeout:
    self.alpaca.cancel_order(order.id)
    logger.warning(f"Limit order for {symbol} not filled in {timeout}s — cancelled")
    notify.send(f"⏱️ {symbol} limit order timed out — price ran too fast", priority=-1)
    return None
```

### Trade-Off

You will miss some trades that would have been winners — the stock gaps past your limit and keeps running. That's okay. The research says the trades you *miss* by being disciplined cost less than the trades you *overpay for* with market orders. If fill rates drop below ~60%, widen the `limit_slippage_pct`.

### Verification

- Paper trade with limit orders for 2+ weeks and compare fill prices vs. snapshot prices.
- Track: fill rate (% of signals that actually fill), average slippage (fill price vs snapshot), and missed-trade opportunity cost (how did the unfilled signals perform?).

---

## Fix #4: Backtester Friction Modeling

**Priority:** 🟡 High
**Effort:** Medium
**Why:** The backtester assumes perfect fills at exact prices with zero slippage, zero spread, and no gap-through risk. On $1–$10 small caps, this dramatically overstates returns. The QuantifiedStrategies backtests use 0.03% slippage on S&P 500 stocks — your universe is 50–100x less liquid.

### What to Build

Add configurable friction to the backtester's fill logic: entry slippage, exit slippage, gap-through modeling, and spread cost.

### Where It Goes

**Config** — add to backtest run parameters (CLI args or config dict):
```python
friction = {
    "entry_slippage_pct": 0.5,   # Entry fills 0.5% worse than open
    "exit_slippage_pct": 0.3,    # Exit fills 0.3% worse than stop/close
    "spread_cost_pct": 0.2,      # Round-trip spread cost
    "model_gap_through": True,   # If open < stop, fill at open (not stop)
}
```

**Implementation** — `MomentumBacktester/backtest_momentum_breakout.py`:

In `simulate_trade()` (around lines 480–560):

**Entry fill (line 497):**
```python
# Current: entry_price = float(df.iloc[entry_idx]["open"])
# New:
raw_open = float(df.iloc[entry_idx]["open"])
entry_slippage = friction.get("entry_slippage_pct", 0) / 100
spread_cost = friction.get("spread_cost_pct", 0) / 200  # Half spread on entry
entry_price = raw_open * (1 + entry_slippage + spread_cost)
```

**Hard stop fill (lines 530–535):**
```python
# Current: if day_low <= hard_stop: exit_price = hard_stop
# New:
if day_low <= hard_stop:
    day_open = float(bar["open"])
    if friction.get("model_gap_through", False) and day_open < hard_stop:
        # Gap-through: stock opened below stop — fill at open, not stop
        exit_price = day_open * (1 - exit_slippage)
    else:
        exit_price = hard_stop * (1 - exit_slippage)
```

**Trailing stop fill** — same gap-through logic as hard stop.

**EOD/time stop fill:**
```python
# Current: exit_price = day_close
# New:
exit_price = day_close * (1 - exit_slippage - spread_cost / 2)
```

### Recommended Slippage Values for This Universe

| Friction | Conservative | Moderate | Aggressive |
|----------|-------------|----------|------------|
| Entry slippage | 1.0% | 0.5% | 0.25% |
| Exit slippage | 0.5% | 0.3% | 0.15% |
| Spread cost (round trip) | 0.5% | 0.2% | 0.1% |
| Gap-through | On | On | Off |

Run the backtest at all three levels. If the strategy is profitable at "Conservative," it's real. If it only works at "Aggressive," the edge is probably slippage.

### Verification

- Run 2025 backtest with moderate friction and compare headline metrics to the frictionless run.
- The key question: does the profit factor stay above 1.5? If yes, the strategy survives friction. If it drops below 1.0, the "edge" was fake.

---

## Fix #5: Max Drawdown Circuit Breaker

**Priority:** 🟡 High
**Effort:** Low
**Why:** The bot has no account-level loss limit. A regime shift producing a string of losses compounds unchecked.

### What to Build

A guardrail that pauses new entries when the account has drawn down too far from its peak.

### Where It Goes

**Config addition** — `config/strategies/ma20_momentum.yaml`:
```yaml
risk:
  # ... existing stop params ...
  max_drawdown_pct: 15.0         # Pause entries if account down 15% from peak
  drawdown_cooldown_days: 5      # Wait N days after trigger before re-enabling
```

**Implementation** — `bot/guardrails.py`:

```python
def is_drawdown_acceptable(self, current_equity: float) -> tuple[bool, str]:
    """Check if account drawdown is within limits."""
    max_dd = self.config.get("risk", {}).get("max_drawdown_pct", 15.0)
    
    peak_equity = self._get_peak_equity()  # From journal or state file
    if peak_equity <= 0:
        return True, ""
    
    drawdown_pct = ((peak_equity - current_equity) / peak_equity) * 100
    
    if drawdown_pct >= max_dd:
        return False, f"Drawdown {drawdown_pct:.1f}% exceeds limit ({max_dd}%)"
    
    return True, ""
```

**Peak equity tracking:** Store the account's high water mark in a state file (e.g., `state/equity_hwm.json`). Update it daily when equity exceeds the previous peak. This survives restarts.

**Integration:** Call `is_drawdown_acceptable()` inside `can_trade()` in guardrails.py, alongside the existing checks.

### Verification

- Manually set `max_drawdown_pct: 5.0` and simulate a losing trade in paper trading. Confirm the bot blocks the next entry and sends a Pushover alert.
- In the backtester, add the same drawdown check and see how it affects 2025 results (it may reduce total trades but should improve risk-adjusted returns).

---

## Fix #6: Multi-Year Backtest Validation

**Priority:** 🟠 Medium-High
**Effort:** Medium (depends on data availability)
**Why:** The 2025 backtest covers a single favorable year. 44% of published strategies fail to replicate on new data. The strategy has never been tested through a bear market.

### What to Do

This isn't a code change — it's a validation exercise.

1. **Check Alpaca historical data range.** Run:
   ```python
   from alpaca.data import StockHistoricalDataClient
   client = StockHistoricalDataClient(api_key, secret_key)
   # Try fetching SPY bars from 2020-01-01
   ```
   Determine the earliest date with reliable daily bars for the universe.

2. **Run backtests on these periods:**
   - **2022 (rate hikes):** SPY fell ~25%, small caps worse. Momentum should underperform.
   - **2020 March–June (COVID crash + recovery):** Extreme volatility, momentum crash then reversal.
   - **2018 Q4 (VIX spike):** Sharp correction, small-cap weakness.
   - **2023–2024 (mixed):** Some trending, some choppy.

3. **For each period, run with and without the regime filter** (Fix #1). Compare:
   - Total return
   - Max drawdown
   - Win rate
   - Profit factor
   - Number of trades taken vs filtered

4. **Key question to answer:** Is the strategy profitable across regimes, or is it a bull-market-only system? If the latter, the regime filter is non-negotiable for live trading.

### Data Considerations

- Alpaca's free tier may have limited historical depth. Check if data goes back to 2018.
- If not, consider supplementing with Yahoo Finance (`yfinance` pip package) for longer backtests.
- **Critical:** Verify whether Alpaca historical bars include stocks that have since delisted. If they don't, your backtest has survivorship bias. The SSRN research estimates ~5% annual return overstatement from this in small-cap indices.

---

## Fix #7: ATR-Based Trailing Stop

**Priority:** 🟠 Medium
**Effort:** Medium
**Why:** The fixed 4.5% trailing stop may be too tight for small caps that routinely move 5–7%+ intraday. Research found optimal trailing stops at 15–20% for maximizing cumulative returns. An ATR-based trail adapts to each stock's actual volatility.

### What to Build

Replace the fixed-percentage trailing stop with one based on Average True Range (ATR).

### Where It Goes

**Config addition** — `config/strategies/ma20_momentum.yaml`:
```yaml
risk:
  trail_mode: atr          # "fixed" (current) or "atr"
  trail_stop_pct: 4.5      # Used when trail_mode = fixed
  trail_atr_period: 14     # ATR lookback period
  trail_atr_multiplier: 2.0  # Trail at 2x ATR below high water mark
```

**Implementation** — `bot/order_flow.py`:

When calculating the trailing stop price (in the stop upgrade logic):

```python
if trail_mode == "atr":
    atr = self._calculate_atr(symbol, period=14)  # From daily bars
    trail_distance = atr * multiplier
    trailing_stop_price = high_water_mark - trail_distance
else:
    trailing_stop_price = high_water_mark * (1 - trail_stop_pct / 100)
```

**ATR calculation:**
```python
def _calculate_atr(self, symbol: str, period: int = 14) -> float:
    """Calculate Average True Range from daily bars."""
    bars = self.data_cache.get_bars(symbol, days=period + 5)
    true_ranges = []
    for i in range(1, len(bars)):
        high = bars[i].high
        low = bars[i].low
        prev_close = bars[i-1].close
        tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
        true_ranges.append(tr)
    return sum(true_ranges[-period:]) / period
```

**Store ATR at entry:** Calculate ATR when entering the position and store it in `active_trade.json` (add an `entry_atr` field). This way the trail distance is fixed at entry time and doesn't change — you're trailing at a fixed dollar amount based on the stock's volatility at entry, not a moving target.

### Backtester Support

Add the same ATR trail to `simulate_trade()`. Calculate ATR from the bars preceding the entry date. Compare performance at 1.5x, 2.0x, 2.5x, and 3.0x ATR multipliers.

### Verification

- Run the backtester with ATR trail (2x) vs fixed trail (4.5%) on 2025 data.
- Look at: exit reason distribution (are fewer trades getting shaken out?), average winner size (should increase if the trail gives more room), and overall profit factor.

---

## Fix #8: Survivorship Bias Check

**Priority:** 🟠 Medium
**Effort:** Medium-High
**Why:** Survivorship bias inflates small-cap backtest returns by ~5% annually. Stocks that delisted (went bankrupt, got acquired at low prices) during the backtest period aren't in the data — but the live bot would have traded them.

### What to Do

1. **Test Alpaca's historical data for delisted stocks:**
   ```python
   # Try fetching bars for a known delisted stock
   # Example: WISH (delisted 2024), CLOV, or other small caps that disappeared
   bars = client.get_stock_bars("WISH", start="2023-01-01", end="2024-01-01")
   ```
   If Alpaca returns data for delisted symbols, your backtest already includes them (good). If it returns an error, you have survivorship bias.

2. **If Alpaca excludes delisted stocks:**
   - Option A: Supplement with `yfinance` which includes delisted stock data
   - Option B: Accept the bias but discount backtest returns by ~5% annually as a mental adjustment
   - Option C: Use a paid data source that explicitly includes delistings (e.g., Polygon.io, Norgate Data)

3. **Quantify the impact:** Run the backtester with and without known-delisted stocks from your time period. If you can get a list of NASDAQ/NYSE delistings from 2025, manually add them to the scanner universe and see if any trigger signals.

---

## Fix #9: Multi-Strategy / Multi-Position (Future)

**Priority:** 🔵 When ready
**Effort:** High
**Why:** Research shows multi-strategy portfolios dramatically outperform single strategies. QuantifiedStrategies showed 5 complementary strategies turning $100K → $3.6M with only 2 losing years. The orchestrator is already spec'd but not built.

### What to Build

This is the big one and requires the most architectural work. The spec already exists at `Docs/ArcherStocks_System_Spec.md`. Key pieces:

1. **Orchestrator:** Coordinates multiple strategy instances on shared accounts with cross-strategy exposure limits.
2. **Complementary strategy:** A mean-reversion signal for range-bound markets would cover the regime where momentum fails. This creates natural hedging.
3. **Position allocation:** With Kelly sizing (Fix #2), multiple positions become possible. The orchestrator divides Kelly-allocated capital across concurrent signals.

### Prerequisites

Fixes #1 (regime filter) and #2 (Kelly sizing) should be done first. The regime filter tells you *which* strategy to run (momentum in trending markets, mean-reversion in choppy markets). Kelly sizing tells you *how much* to allocate per position.

### Implementation Notes

- The `max_concurrent_positions` field already exists in the YAML config — it's just set to 1.
- `order_flow.py` already checks for existing positions before entering. It would need to support a list of `ActiveTrade` objects instead of a single one.
- The scanner already returns ranked lists. For multi-position, take the top N instead of top 1.

---

## General Implementation Notes for Claude

### Before Starting Any Fix

1. **Read the strategy YAML first:** `config/strategies/ma20_momentum.yaml` — this is the source of truth for all parameters.
2. **Read the relevant bot file** you'll be modifying. The codebase is well-structured and commented.
3. **Check for an active trade** before testing: `state/active_trade.json` — if it's not `null`, there's a live position. Don't modify bot code during a live trade.
4. **Use the project-docs skill** after completing any feature to update the spec, TODO, and docs.
5. **Use the feature-complete skill** to run the full wrap-up workflow (docs, commit, push).

### Commit Style

Bec uses clean `type: description` format with no co-author trailers:
```
feat: add market regime filter to guardrails
fix: use limit orders for entry instead of market orders
refactor: add Kelly position sizing to order_flow
```

### Testing Approach

There are no unit tests (yet). Validation is through:
1. **Backtester:** Run before and after changes, compare metrics
2. **Paper trading:** Alpaca paper account for live validation
3. **Logs:** Check `logs/` for expected behavior
4. **Pushover alerts:** Verify correct notifications fire

### Config Hot-Reload

The monitor loop checks the YAML file's modification time every iteration. If you change config values, the bot picks them up without a restart. New fields need to be handled gracefully with `.get()` defaults so the bot doesn't crash on an older config file.
