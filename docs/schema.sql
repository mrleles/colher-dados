create table if not exists public.telemetry_sessions (
  id uuid primary key,
  protocol_id varchar(100) not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  is_used boolean not null default false
);

create index if not exists telemetry_sessions_protocol_id_idx on public.telemetry_sessions (protocol_id);
create index if not exists telemetry_sessions_expires_at_idx on public.telemetry_sessions (expires_at);

create table if not exists public.telemetry_metrics (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.telemetry_sessions(id) on delete cascade,
  user_agent text,
  os varchar(100),
  device_brand varchar(100),
  device_model varchar(255),
  device_model_name varchar(255),
  device_model_confidence varchar(20),
  ram_gb double precision,
  client_ip inet,
  isp varchar(255),
  net_effective_type varchar(16),
  net_rtt integer,
  net_save_data boolean,
  ping_median double precision,
  download_speed double precision,
  collected_at timestamptz not null default now()
);

create index if not exists telemetry_metrics_session_id_idx on public.telemetry_metrics (session_id);

alter table public.telemetry_sessions enable row level security;
alter table public.telemetry_metrics enable row level security;

revoke all on public.telemetry_sessions from anon, authenticated;
revoke all on public.telemetry_metrics from anon, authenticated;

create or replace function public.submit_telemetry(
  p_session_id uuid,
  p_user_agent text,
  p_os varchar,
  p_device_brand varchar,
  p_device_model varchar,
  p_device_model_name varchar,
  p_device_model_confidence varchar,
  p_ram_gb double precision,
  p_client_ip inet,
  p_isp varchar,
  p_net_effective_type varchar,
  p_net_rtt integer,
  p_net_save_data boolean,
  p_ping_median double precision,
  p_download_speed double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires_at timestamptz;
  v_is_used boolean;
begin
  select expires_at, is_used into v_expires_at, v_is_used
    from public.telemetry_sessions
   where id = p_session_id
   for update;

  if not found or v_is_used or v_expires_at <= now() then
    raise exception 'invalid_or_expired_session';
  end if;

  insert into public.telemetry_metrics (
    session_id, user_agent, os, device_brand, device_model, device_model_name, device_model_confidence, ram_gb,
    client_ip, isp,
    net_effective_type, net_rtt, net_save_data,
    ping_median, download_speed
  ) values (
    p_session_id, p_user_agent, p_os, p_device_brand, p_device_model, p_device_model_name, p_device_model_confidence, p_ram_gb,
    p_client_ip, p_isp,
    p_net_effective_type, p_net_rtt, p_net_save_data,
    p_ping_median, p_download_speed
  );

  update public.telemetry_sessions set is_used = true where id = p_session_id;
end;
$$;

revoke all on function public.submit_telemetry(
  uuid,text,varchar,varchar,varchar,varchar,varchar,double precision,inet,varchar,
  varchar,integer,boolean,double precision,double precision
) from public;
