/**
 * lib/rydnow/config.ts
 *
 * Public entry point for RYDNOW frontend constants.
 *
 * Every constant, type and pure helper now lives in ./constants (which imports nothing
 * from api.ts or config.ts, so there is no circular import). This file re-exports all of
 * it, so existing `import { ... } from "@/lib/rydnow/config"` lines keep working.
 *
 * RULE: nothing here is used to calculate a price. Fares come only from
 *   POST /api/booking/calculate-price/   (via api.booking.quote in ./api.ts)
 */
import { configureApi } from "@/lib/rydnow/api";
import { SERVICE_HINTS, formatMoney, type ServiceKey } from "./constants";

// Re-export everything (values and types) from the shared file.
export * from "./constants";

// Runtime API settings. A sleeping Render instance can be slow on the first call.
configureApi({ timeoutMs: 60_000 });

/** The trust line under the price card, built from SERVICE_HINTS. */
export function cancellationPolicyText(service: ServiceKey): string {
  const h = SERVICE_HINTS[service];
  return (
    `Cancel free until a rider accepts. After that, free for ${h.cancelGraceMinutes} ` +
    `minutes, then a small fee of ${formatMoney(h.cancelFeeAccepted)}.`
  );
}

