# Database Migration Policy

## Blue-Green Backward Compatibility Requirement

All database migrations **MUST** be backward-compatible with the previous release. The deploy script runs migrations while the old slot serves traffic — a breaking migration will cause production errors on the old slot.

## Expand-Contract Pattern

All destructive schema changes must use the **expand-contract** pattern:

### Expand Phase (deployed first)
- Add new columns/tables
- Keep old columns intact
- Both old and new app code works against this schema

### Contract Phase (deployed after all slots run new code)
- Remove old columns/rename in a subsequent release
- Only safe after verifying no traffic hits the old schema

## Examples

### Migrations Requiring Expand-Contract
- `DROP COLUMN` — old slot queries will fail with "column does not exist"
- `RENAME COLUMN` — old slot queries reference the old name
- `ALTER COLUMN TYPE` — old slot may send incompatible data types
- `DROP TABLE` — old slot queries fail with "relation does not exist"

### Safe Single-Release Migrations
- `ADD COLUMN` (nullable or with default) — old slot ignores it
- `CREATE TABLE` — old slot doesn't reference it
- `CREATE INDEX` — transparent to application queries

## Migration Execution

- Migrations run via `scripts/deploy.sh` using `dist/scripts/migrate.js`
- `RUN_MIGRATIONS=false` on both app slots prevents auto-migration at startup
- Migrations execute on the new slot only, before nginx switches traffic
- The migration function uses a separate connection pool (`max: 1`, no `statement_timeout`)
