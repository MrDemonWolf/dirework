-- Contract step for 0015: task_status_completed_idx (status, completed_at) has a
-- status prefix, so it already serves every status-only predicate. Safe now that
-- no deployed worker predates 0015.
DROP INDEX IF EXISTS `task_status_idx`;
