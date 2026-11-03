/**
 * Mobile entry point for the automatic academic-structure feature.
 *
 * The website imports the EXACT same files through `lib/academic/*.ts` shims.
 * Keep all business logic in packages/attendly-core; this folder only adapts
 * Supabase row shapes and never re-implements a rule.
 */
export * from "../../../../../packages/attendly-core/src/index.ts";
export * from "./structure.ts";
