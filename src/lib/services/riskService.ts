// Phase 4 (spec section 43): the configurable clinical rules engine.
// Evaluates a new clinical_visits row against every active row in
// clinical_rules and raises risk_flags rows, recording rule_version for
// traceability. Deliberately does not — and must never — invent
// threshold values itself (spec section 11); it only evaluates what an
// administrator has configured and active.
export {};
