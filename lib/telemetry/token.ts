import { randomUUID } from "node:crypto";

export const TELEMETRY_TTL_MINUTES = 60;

export function createTelemetryToken() {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + TELEMETRY_TTL_MINUTES * 60_000);
  return { id, expiresAt };
}
