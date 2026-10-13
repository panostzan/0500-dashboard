# Security and privacy

## Data boundaries

Personal backups, database exports, local environment files, and browser profiles must not be committed or deployed. Ignore rules help prevent accidental additions; they do not remove data already present in Git history.

Supabase browser clients use a public `anon` key. Access protection must be enforced by database grants and row-level security, not by hiding that key or relying on client-side filters. Never place service-role keys, private API credentials, or user session tokens in source code.

See the [Supabase API key documentation](https://supabase.com/docs/guides/api/api-keys) and [row-level security guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

The current Strava integration stores user-supplied credentials in local storage. Browser storage is accessible to scripts on the same origin and is not a secrets vault. Shared deployments should use a server-side OAuth flow before offering this integration to other users.

## Reporting an issue

Please do not post credentials, personal records, or exploit details in public issues. Use GitHub private vulnerability reporting through this repository's Security tab.

This is a personal project; there is no guaranteed response time or formal security support policy.
