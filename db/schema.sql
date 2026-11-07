create table if not exists checkpoints (
  id text primary key,
  created_at timestamptz default now(),
  plan_id text not null,
  subscription_id text unique,
  intent_text text not null,
  intent_json jsonb not null,
  merchant_copy text,
  claims_json jsonb,
  terms_json jsonb not null,
  terms_hash text not null,
  findings_json jsonb not null,
  max_severity text not null,
  explanation text,
  decision text,
  acked_ids text[],
  decided_at timestamptz,
  paypal_status text
);
create table if not exists audit_events (
  id bigserial primary key,
  checkpoint_id text references checkpoints(id),
  type text not null,
  source text not null,
  paypal_event_id text unique,
  verified boolean,
  payload jsonb,
  created_at timestamptz default now()
);
