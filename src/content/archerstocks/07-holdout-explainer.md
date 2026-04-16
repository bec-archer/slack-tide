# The Holdout: what it is, why we're doing it, and why it's locked down

*Reading assignment for Archer — April 15, 2026*

---

## TL;DR

1. Before we seriously start tuning strategies, we're carving off a chunk of recent market data and making it untouchable: you can't backtest on it, I can't backtest on it, and the system itself will reject any run that tries. This is called an out-of-sample holdout, and it's the honest test we're building into the backtester.

2. The holdout is the only way we can tell whether a strategy actually works before you put real money on it. Everything else is just measuring how well we memorized the past.

3. I'm proposing a 12-month holdout (cutoff date 2025-04-12, so everything from that date forward gets sealed). Good ballpark, and your trade frequency makes it plenty for evaluation purposes.

4. Once the holdout is committed, we can only "use" it once per strategy, via a final-evaluation token I hand out. Not because I want to be your gatekeeper, but because peeking ruins the test, and the test is the one thing standing between you and a strategy that looks great in backtest and loses you money live.

5. What I need from you: thumbs up or thumbs down on the 12-month window, and a heads-up if there's anything you want to test on the full data range before we lock it.

---

## The metaphor version

You tune a truck on a road you drive every day. You know every pothole, every hill, every weird stretch. You can dial that truck in to ride like it's on rails on *that* road.

But here's the question: did you build a truck that drives great, or did you build a truck that drives great *on that road*?

Only way to know is to drive it somewhere you've never been. If it handles a road it's never seen, the tune is real. If it doesn't, you overfit to the road you knew.

The holdout is exactly that: a stretch of market history we seal off and never look at while we're building the strategy. It stays untouched until we think we're done. Then we run it, one time, and we find out if the strategy works or if we just memorized the last six years.

The rule is: **don't peek.** The second you run a backtest that touches the holdout, you've started tuning against it. Even if you don't think you are: if you see it didn't work and you go back and tweak the strategy based on what you saw, you've contaminated the test. Now the holdout is just more in-sample data and we're back to square one.

---

## Why this matters for you specifically

Live trading with real money is the ultimate out-of-sample test, and that one costs cash when it fails. The holdout is the closest thing we can build to a live test using data we already have in hand. If we break it, we lose the one check we've got, and we find out the strategy's bad the hard way (with your money, on the first weeks of live deployment).

You already know the pain of a strategy that backtested great and then fell apart the moment real cash was on it. That's exactly what the holdout is designed to catch before it happens. It won't catch everything (live markets have slippage and microstructure quirks that no historical data fully reflects), but it catches the single biggest source of backtest-to-live disappointment: a strategy that was curve-fit to the development period.

---

## What actually happens when the holdout is locked

The cutoff date gets written to a protected row in the database. After that:

- Any backtest request whose date range touches the holdout gets rejected by the system with a clear error. Not a UI warning, not a "are you sure" dialog. The server refuses the run.
- There's no "override" button. There's no "I'm the admin" bypass. I can't turn it off from the UI and neither can you. Disabling it would require direct database access on my end, which creates a visible audit trail.
- The one legitimate way to use the holdout is via a **final-evaluation token**. When you're genuinely done tuning a strategy variant and ready to see how it performs on the untouched data, you ask me for a token, I issue one, and you use it once. The run is recorded permanently, tied to the specific strategy config, and the token is burned.
- If you tweak the strategy afterward, it's a new strategy. New token. The old holdout result still sits on the books (you can't un-see it, which is the whole point).

This is deliberately ceremonial. The friction is the feature: it forces the "am I really done?" conversation at exactly the right moment.

---

## Why it's locked hard instead of just a rule we agree on

Because rules we agree on don't survive contact with a motivated day trader who's convinced he's "just checking real quick." You know this. I know this. I'd rather build the system so neither of us has to be disciplined enough to never peek (which, let's be honest, neither of us is, lol): it's just not a thing that can happen in the first place.

There's also a practical reason: you and I are both going to be running backtests over the coming months. If the rule is "don't run on holdout data," one of us is going to accidentally do it at some point, and then we've contaminated the test and we don't even remember doing it. Backend enforcement means accidental leakage can't happen. Only deliberate cheating is technically possible, and if we've reached that point we've got a much bigger problem than a holdout.

---

## Why I'm picking 12 months

For low-frequency strategies (the Connors momentum stuff in baseline_v1, which runs about 6 trades per year), you want a long holdout because you need enough trades to trust the result. For a scalper running 3 to 10 trades per day, sample size is not the bottleneck: even a 3-month holdout would give hundreds of trades. So for scalping evaluation, "how many trades" isn't what drives the length.

What drives it is **market regime variety**. A strategy that crushed in choppy, range-bound tape might fall apart in a strong trend (or vice versa). We want the holdout to span enough different conditions that when a strategy holds up, we actually believe it'll hold up in the next regime change too.

A 12-month holdout gets us:

- Hundreds of trades for scalper evaluation (way more than statistically needed).
- Roughly 15 trades for Connors evaluation (thin but workable).
- At least one full year of varied regimes: trends, ranges, volatility events, earnings cycles, Fed cycles.
- Data recent enough that current market microstructure (HFT behavior, tick sizes, liquidity patterns) still reflects what the live bot faces today.
- Five full years of in-sample data (2020-01-02 through 2025-04-11) left to develop against. Plenty of runway.

6 months would work for scalper alone but gets thin on regime variety and is close to useless for Connors. 18 to 24 months eats into in-sample data we actively need for development. 12 is the sweet spot.

---

## What I need from you

Two things, simple as I can make them:

1. **Thumbs up or down on the 12-month window.** If you want a different length (longer, shorter, a specific date you want the cutoff to land on), tell me. Once we commit, the date is locked.

2. **Anything you want to test on the full data range before we lock it?** If there's a strategy idea that specifically needs to look at recent market conditions, run it *now*, before the cutoff goes in. Once committed, the last 12 months are off-limits until final evaluation time.

If both are green-lit, I'll commit the holdout as part of Milestone 2 of the backtester UI build, and from that moment forward we're in officially disciplined in-sample territory.
