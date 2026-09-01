-- pgTAP is required only to execute the versioned database contract and RLS
-- test suites; application code does not depend on it at runtime.
create extension if not exists pgtap with schema extensions;
