
-- Core event store
CREATE TABLE IF NOT EXISTS idpf_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id      VARCHAR(64) NOT NULL,
    event_timestamp     TIMESTAMPTZ NOT NULL,
    service_node        VARCHAR(64) NOT NULL,
    result              VARCHAR(128),
    reason_code         VARCHAR(64),
    rule_fired          VARCHAR(64),
    input_payload       JSONB,
    output_payload      JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_tx     ON idpf_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_events_ts     ON idpf_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_events_rule   ON idpf_events(rule_fired);
CREATE INDEX IF NOT EXISTS idx_events_result ON idpf_events(result);
CREATE INDEX IF NOT EXISTS idx_events_node   ON idpf_events(service_node);

-- GSA features table (denormalized for ML/analytics)
CREATE TABLE IF NOT EXISTS gsa_features (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id   VARCHAR(64) NOT NULL UNIQUE,
    cmra_flag        BOOLEAN DEFAULT FALSE,
    pbsa_flag        BOOLEAN DEFAULT FALSE,
    pobox_flag       BOOLEAN DEFAULT FALSE,
    fault_code       VARCHAR(16),
    gen_return_code  VARCHAR(4),
    dpv_code         VARCHAR(4),
    comm_error       BOOLEAN DEFAULT FALSE,
    continue_on_risk VARCHAR(2) DEFAULT '0',
    customer_key_present BOOLEAN DEFAULT TRUE,
    domestic_addr_type   VARCHAR(16) DEFAULT 'INDIVIDUAL',
    gsa_result       VARCHAR(64),
    pdma_result      VARCHAR(64),
    final_result     VARCHAR(64),
    event_date       DATE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gsa_tx   ON gsa_features(transaction_id);
CREATE INDEX IF NOT EXISTS idx_gsa_date ON gsa_features(event_date);
CREATE INDEX IF NOT EXISTS idx_gsa_final ON gsa_features(final_result);

-- Transaction summary (flattened per-transaction view)
CREATE TABLE IF NOT EXISTS transaction_summary (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id   VARCHAR(64) NOT NULL UNIQUE,
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    doc_result       VARCHAR(64),
    face_result      VARCHAR(64),
    gsa_result       VARCHAR(64),
    pdma_result      VARCHAR(64),
    risk_result      VARCHAR(64),
    final_result     VARCHAR(64),
    rules_fired      JSONB DEFAULT '[]',
    reason_codes     JSONB DEFAULT '[]',
    primary_decline_reason VARCHAR(128),
    event_date       DATE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ts_tx     ON transaction_summary(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ts_date   ON transaction_summary(event_date);
CREATE INDEX IF NOT EXISTS idx_ts_final  ON transaction_summary(final_result);
CREATE INDEX IF NOT EXISTS idx_ts_pdr    ON transaction_summary(primary_decline_reason);

-- Drift baselines
CREATE TABLE IF NOT EXISTS drift_baselines (
    id              SERIAL PRIMARY KEY,
    variable_name   VARCHAR(64) NOT NULL,
    baseline_date   DATE NOT NULL,
    distribution    JSONB NOT NULL,
    mean_val        FLOAT,
    std_val         FLOAT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- What-If simulation results
CREATE TABLE IF NOT EXISTS simulations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(128),
    rule_overrides      JSONB NOT NULL DEFAULT '{}',
    baseline_rate       FLOAT,
    simulated_rate      FLOAT,
    delta               FLOAT,
    ci_low              FLOAT,
    ci_high             FLOAT,
    affected_tx_count   INT,
    breakdown           JSONB DEFAULT '{}',
    n_iterations        INT DEFAULT 10000,
    created_by          VARCHAR(64) DEFAULT 'analyst',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: enable on all tables (open read for anon for this demo)
ALTER TABLE idpf_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsa_features        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_baselines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulations         ENABLE ROW LEVEL SECURITY;

-- SELECT policies (allow anon read for demo portal)
CREATE POLICY "anon_select_events"   ON idpf_events         FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_gsa"      ON gsa_features        FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_ts"       ON transaction_summary FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_drift"    ON drift_baselines     FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_sims"     ON simulations         FOR SELECT TO anon USING (true);

-- INSERT policies
CREATE POLICY "anon_insert_events"   ON idpf_events         FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_gsa"      ON gsa_features        FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_ts"       ON transaction_summary FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_drift"    ON drift_baselines     FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_sims"     ON simulations         FOR INSERT TO anon WITH CHECK (true);

-- UPDATE/DELETE policies
CREATE POLICY "anon_update_sims"     ON simulations         FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_sims"     ON simulations         FOR DELETE TO anon USING (true);
