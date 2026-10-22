# Data API follow-up

Checked 2026-10-22: backup table RLS is enabled in Supabase, and migration enable_rls_client_misclassified_backup_20261022 is recorded.

Future schema changes must explicitly grant API access only where necessary and include corresponding RLS policies. No production grants should be changed globally. Verify table creation migrations across all ArtEssencia repositories prior to merging.

No frontend deployment required for this RLS correction. Functional application regression tests remain outstanding.
