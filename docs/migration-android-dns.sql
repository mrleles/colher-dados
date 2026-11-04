-- Apply in Supabase before deploying the matching Next.js version.
create table if not exists public.telemetry_android_tokens (
  session_id uuid primary key references public.telemetry_sessions(id) on delete cascade,
  token_hash char(64) not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists telemetry_android_tokens_expires_at_idx on public.telemetry_android_tokens (expires_at);

create table if not exists public.telemetry_android_metrics (
  session_id uuid primary key references public.telemetry_sessions(id) on delete cascade,
  android_version varchar(40) not null,
  sdk_int integer not null check (sdk_int >= 28),
  manufacturer varchar(100) not null,
  model varchar(120) not null,
  connection_type varchar(16) not null,
  vpn_active boolean not null,
  active_interface varchar(100),
  dns_servers jsonb not null default '[]'::jsonb,
  private_dns_active boolean not null,
  private_dns_server_name varchar(253),
  gateway varchar(100),
  routes jsonb not null default '[]'::jsonb,
  local_addresses jsonb not null default '[]'::jsonb,
  client_collected_at timestamptz not null,
  app_version varchar(32) not null default '1.0.0',
  collected_at timestamptz not null default now()
);
create index if not exists telemetry_android_metrics_collected_at_idx on public.telemetry_android_metrics (collected_at desc);

alter table public.telemetry_android_tokens enable row level security;
alter table public.telemetry_android_metrics enable row level security;
revoke all on public.telemetry_android_tokens from anon, authenticated;
revoke all on public.telemetry_android_metrics from anon, authenticated;

create or replace function public.submit_android_telemetry(p_token_hash text, p_metrics jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_session_id uuid;
begin
  select session_id into v_session_id from public.telemetry_android_tokens
   where token_hash = p_token_hash and used_at is null and expires_at > now()
   for update;
  if not found then raise exception 'invalid_or_expired_android_token'; end if;

  insert into public.telemetry_android_metrics (
    session_id, android_version, sdk_int, manufacturer, model, connection_type,
    vpn_active, active_interface, dns_servers, private_dns_active,
    private_dns_server_name, gateway, routes, local_addresses, client_collected_at, app_version
  ) values (
    v_session_id, p_metrics->>'androidVersion', (p_metrics->>'sdkInt')::integer,
    p_metrics->>'manufacturer', p_metrics->>'model', p_metrics->>'connectionType',
    (p_metrics->>'vpnActive')::boolean, p_metrics->>'activeInterface',
    coalesce(p_metrics->'dnsServers', '[]'::jsonb), (p_metrics->>'privateDnsActive')::boolean,
    p_metrics->>'privateDnsServerName', p_metrics->>'gateway',
    coalesce(p_metrics->'routes', '[]'::jsonb), coalesce(p_metrics->'localAddresses', '[]'::jsonb),
    (p_metrics->>'clientCollectedAt')::timestamptz,
    coalesce(p_metrics->>'appVersion', '1.0.0')
  );
  update public.telemetry_android_tokens set used_at = now() where session_id = v_session_id;
end;
$$;
revoke all on function public.submit_android_telemetry(text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_android_telemetry(text, jsonb) to service_role;
