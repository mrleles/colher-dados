-- Telemetry schema migration: IP/ISP, battery/DNS and Ookla test server.
-- Apply this migration in Supabase before deploying the application.

alter table public.telemetry_metrics
  drop column if exists wifi_ssid,
  drop column if exists wifi_frequency_mhz,
  drop column if exists wifi_signal_strength_dbm,
  add column if not exists client_ip inet,
  add column if not exists isp varchar(255),
  add column if not exists battery_level smallint,
  add column if not exists dns_server varchar(255),\n  add column if not exists ookla_server_id integer,\n  add column if not exists ookla_server_name varchar(255),\n  add column if not exists ookla_server_city varchar(255),\n  add column if not exists ookla_server_host varchar(255);

alter table public.telemetry_metrics
  drop constraint if exists telemetry_metrics_battery_level_check;

alter table public.telemetry_metrics
  add constraint telemetry_metrics_battery_level_check
  check (battery_level is null or battery_level between 0 and 100);

create or replace function public.submit_telemetry(
  p_session_id uuid,
  p_user_agent text,
  p_os varchar,
  p_device_brand varchar,
  p_device_model varchar,
  p_device_model_name varchar,
  p_device_model_confidence varchar,
  p_ram_gb double precision,
  p_battery_level smallint,
  p_dns_server varchar,
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
    session_id, user_agent, os, device_brand, device_model,
    device_model_name, device_model_confidence, ram_gb,
    battery_level, dns_server,
    client_ip, isp,
    net_effective_type, net_rtt, net_save_data,
    ping_median, download_speed
  ) values (
    p_session_id, p_user_agent, p_os, p_device_brand, p_device_model,
    p_device_model_name, p_device_model_confidence, p_ram_gb,
    p_battery_level, p_dns_server,
    p_client_ip, p_isp,
    p_net_effective_type, p_net_rtt, p_net_save_data,
    p_ping_median, p_download_speed
  );

  update public.telemetry_sessions set is_used = true where id = p_session_id;
end;
$$;

revoke all on function public.submit_telemetry(
  uuid,text,varchar,varchar,varchar,varchar,varchar,double precision,smallint,varchar,
  inet,varchar,varchar,integer,boolean,double precision,double precision
) from public;
