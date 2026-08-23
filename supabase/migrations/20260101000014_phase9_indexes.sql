-- Migration 0014 (Phase 9 security & optimization pass): two composite
-- indexes for query patterns introduced after migration 0008 was written,
-- found by matching every service query added in Phases 3-8 against the
-- existing index list.

-- Settings/Users (Phase 8): the "don't demote/deactivate the last active
-- administrator" guard in userService.countActiveAdmins runs on every
-- role/status change and filters on both columns together.
create index idx_users_role_status on public.users (role, status);

-- Audit Log viewer (Phase 8): auditService.listAuditLogs filters by
-- entity_type and a created_at date range, then always sorts by
-- created_at desc. Migration 0008's idx_audit_logs_entity is
-- (entity_type, entity_id), which doesn't help the date-range filter or
-- the sort; this composite serves the entity_type+date-range+order
-- combination directly.
create index idx_audit_logs_entity_type_created_at on public.audit_logs (entity_type, created_at desc);
