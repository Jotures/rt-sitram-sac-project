-- An external asset without an approved mapping is visible operationally, but
-- it cannot be reported as a successful snapshot synchronization.

alter table public.gps_sync_runs
  add constraint gps_sync_runs_success_has_no_unlinked_positions check (
    status <> 'succeeded' or positions_unlinked = 0
  );
