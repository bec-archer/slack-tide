-- Gap Log Observability tables for ArcherStocks
-- Synced nightly from events.db on the Mac mini via sync_events_to_supabase.py
-- Field whitelist: no P&L, no position sizes, no entry/exit prices (Gotcha #4)

-- Q1/Q3: Individual rejection events (signal_rejected + entry_skipped)
CREATE TABLE IF NOT EXISTS archerstocks_rejections (
    id              BIGINT PRIMARY KEY,          -- events.db rowid (idempotent upsert key)
    timestamp       TIMESTAMPTZ NOT NULL,
    date            DATE NOT NULL,
    account_id      TEXT NOT NULL DEFAULT 'default',
    symbol          TEXT,
    filter          TEXT,                         -- e.g. "volume_ratio_under", "pdt"
    threshold       NUMERIC,                      -- the filter's threshold value
    actual          NUMERIC,                      -- the actual value that failed
    filters_passed  INT,                          -- how many filters passed before rejection
    context         JSONB                         -- safe subset of the event data blob
);

CREATE INDEX IF NOT EXISTS idx_rejections_symbol_date
    ON archerstocks_rejections (symbol, date);
CREATE INDEX IF NOT EXISTS idx_rejections_date_account
    ON archerstocks_rejections (date, account_id);
CREATE INDEX IF NOT EXISTS idx_rejections_filters_passed
    ON archerstocks_rejections (filters_passed DESC, date DESC);

-- Q2: Scan summary aggregates (one per scan cycle)
CREATE TABLE IF NOT EXISTS archerstocks_scan_summaries (
    id              BIGINT PRIMARY KEY,          -- events.db rowid
    timestamp       TIMESTAMPTZ NOT NULL,
    date            DATE NOT NULL,
    account_id      TEXT NOT NULL DEFAULT 'default',
    universe_size   INT,
    checked         INT,
    passed_price    INT,
    passed_data     INT,
    passed_vol      INT,
    passed_move     INT,
    passed_htb      INT,
    passed_news     INT,
    fired           INT,
    top_symbol      TEXT,
    scan_duration_ms INT
);

CREATE INDEX IF NOT EXISTS idx_scan_summaries_date_account
    ON archerstocks_scan_summaries (date, account_id);

-- Entry-level skip events (separate from scanner rejections)
CREATE TABLE IF NOT EXISTS archerstocks_entry_skipped (
    id              BIGINT PRIMARY KEY,          -- events.db rowid
    timestamp       TIMESTAMPTZ NOT NULL,
    date            DATE NOT NULL,
    account_id      TEXT NOT NULL DEFAULT 'default',
    symbol          TEXT,
    reason          TEXT,                          -- "pdt", "daily_limit", "already_traded", etc.
    context         JSONB                          -- safe subset of the event data blob
);

CREATE INDEX IF NOT EXISTS idx_entry_skipped_date_account
    ON archerstocks_entry_skipped (date, account_id);
CREATE INDEX IF NOT EXISTS idx_entry_skipped_symbol_date
    ON archerstocks_entry_skipped (symbol, date);

-- RLS: these tables are public-read behind the PIN gate (no auth needed from Supabase side)
-- The sync script uses the service role key to write.
ALTER TABLE archerstocks_rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE archerstocks_scan_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE archerstocks_entry_skipped ENABLE ROW LEVEL SECURITY;

-- Allow anon reads (the PIN gate in middleware.ts handles access control)
CREATE POLICY "anon_read_rejections" ON archerstocks_rejections
    FOR SELECT USING (true);
CREATE POLICY "anon_read_scan_summaries" ON archerstocks_scan_summaries
    FOR SELECT USING (true);
CREATE POLICY "anon_read_entry_skipped" ON archerstocks_entry_skipped
    FOR SELECT USING (true);

-- Service role can insert/update (used by the sync script)
CREATE POLICY "service_write_rejections" ON archerstocks_rejections
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_write_scan_summaries" ON archerstocks_scan_summaries
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_write_entry_skipped" ON archerstocks_entry_skipped
    FOR ALL USING (true) WITH CHECK (true);
