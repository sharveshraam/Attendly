/**
 * Public API of the Attendly academic core. Every module here is pure, has no
 * platform imports and is mirrored into `packages/attendly-core` for the
 * Android/iOS app. File-format adapters live in `./formats` and are web-only.
 */
export * from "./types.ts";
export * from "./dates.ts";
export * from "./text.ts";
export * from "./grid.ts";
export * from "./calendar.ts";
export * from "./engine.ts";
export * from "./idempotency.ts";
