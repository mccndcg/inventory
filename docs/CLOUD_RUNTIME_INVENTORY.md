# Legacy cloud runtime inventory

Status: quarantine boundary

This inventory names every remaining executable or configuration surface tied
to the abandoned cloud runtime. It deliberately does not reproduce remote
URLs, credentials, tenant identifiers, or archived values.

## Production boundary

- Production and other non-development builds ignore every module under
  `app/routes`.
- `app/root.tsx` renders only the maintenance screen outside development.
- The maintenance screen can export the pre-existing `goods` IndexedDB
  database through native read-only transactions.
- The exporter requires database discovery support and aborts if opening would
  create or upgrade a database.
- The exporter does not import Dexie, the Dexie Cloud addon, Firebase, or any
  business persistence module.

This is a quarantine, not the target runtime. The route exclusion must remain
until the replacement `inventory_local` database, services, and accepted UI
are ready for the controlled switch.

## Remaining application references

| Path | Remaining reason | Constraint |
| --- | --- | --- |
| `app/data/dexie.ts` | Defines the legacy `goods` database and configures the Dexie Cloud addon. | Quarantined source only; no production route may import or execute it. Do not point plain Dexie at this database name. |

Tests enforce this single-file application-source allowlist. Any new cloud import
must fail the security suite.

## Remaining repository references

| Path | Contents | Disposition |
| --- | --- | --- |
| `dexie-cloud.json` | Legacy CLI endpoint configuration. | Do not use it. Retain only until remote targets are archived and the runtime switch is accepted. |
| `package.json` | Remaining `dexie-cloud-addon` dependency. | Remove with the quarantined legacy adapter after local replacement persistence is accepted. |
| `package-lock.json` | Locked transitive tree for the remaining addon. | Regenerate with the corresponding dependency removal. |
| Recovery documents | Historical evidence, removal procedure, and target contracts. | Preserve as documentation; these are not executable cloud dependencies. |

The key file, embedded Firebase bootstrap, Firebase SDK and prototype helper,
cloud login UI, `/dev` route, clear-then-import workflow, and public legacy
product snapshot have already been removed from the current tree.

## External actions still pending

Repository quarantine does not prove any remote action. Operators must still:

- archive every known Dexie Cloud target and every required local browser
  profile;
- verify that archives can be restored;
- revoke or rotate all previously exposed credentials;
- audit remote access and retention requirements;
- approve remote deletion separately;
- decide whether Git history rewriting is required.

Until those actions and the replacement cutover are complete, deployment is
maintenance-only and the legacy cloud configuration must not be used.

## Quarantine verification snapshot

Recorded on 2026-07-28:

- `npm run test` passed: 3 files and 11 tests;
- `npm run lint` passed with zero warnings;
- `npm run build` passed with only root/maintenance assets and the inherited
  Vite CJS deprecation and stale Browserslist warnings;
- `npm run typecheck` passed;
- `npm audit --omit=dev` reported the six-item Remix/React Router exception
  recorded in `BASELINE.md`, with no critical findings.

This snapshot proves the quarantine surface, not general application
correctness or production readiness.
