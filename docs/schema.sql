create table if not exists public.telemetry_sessions (id uuid primary key, protocol_id varchar(100) not null, created_at timestamptz not null default now(), expires_at timestamptz not null, is_used boolean not null default false);
create index if not exists telemetry_sessions_protocol_id_idx on public.telemetry_sessions (protocol_id);
create index if not exists telemetry_sessions_expires_at_idx on public.telemetry_sessions (expires_at);
create table if not exists public.telemetry_metrics (id bigint generated always as identity primary key, session_id uuid not null references public.telemetry_sessions(id) on delete cascade, user_agent text, os varchar(100), device_model varchar(255), ram_gb double precision, cpu_cores integer, screen_res varchar(32), net_effective_type varchar(16), net_rtt integer, net_save_data boolean, ping_median double precision, download_speed double precision, collected_at timestamptz not null default now());
create index if not exists telemetry_metrics_session_id_idx on public.telemetry_metrics (session_id);
alter table public.telemetry_sessions enable row level security;
alter table public.telemetry_metrics enable row level security;
revoke all on public.telemetry_sessions from anon, authenticated;
revoke all on public.telemetry_metrics from anon, authenticated;
