# Recovery baseline

Status: observed evidence, not a target specification

- Review date: 2026-07-28
- Baseline code before documentation: `6df5d1f` on `main`
- Observed environment: Node `24.15.0`, npm `11.12.1`

Results can change as the recovery progresses. Re-run a gate before relying on
it.

## Executed gates

| Command | Observed result |
| --- | --- |
| `npm ci` | Passed after the Vitest slice; 1,090 packages audited. |
| `npm run test` | Passed after the Vitest slice: 1 file, 1 smoke test. |
| targeted ESLint for `vitest.config.ts` and `tests/smoke.test.ts` | Passed. |
| `npm ls vitest vite --depth=0` | `vitest@3.2.7`, `vite@5.4.14`. |
| `npm run typecheck` | Failed with 26 inherited TypeScript errors. |
| `npm run lint` | Failed with 161 errors and 16 warnings. |
| `npm run build` | Passed after the clean install, with stale Browserslist and source-map warnings. |
| `npm start` after build | Failed because the completed SPA build has no `build/server/index.js`. |

The current Vitest smoke test proves only that TypeScript tests execute in the
Node environment.

## Dependency observations

The clean install after the Vitest slice reported 54 full-tree
vulnerabilities: 7 critical, 29 high, 13 moderate, and 5 low.

The production-only audit immediately before that install reported:

- production tree: 30 vulnerabilities — 5 critical, 16 high, 6 moderate, and
  3 low;

These are historical counts, not a claim about the latest advisory database.
Re-run `npm audit` and inspect direct dependency upgrade paths during the
baseline phase. Do not mix broad dependency upgrades with domain behavior.

The Vitest install added the compatible v3 runner while keeping Vite on
`5.4.14`. Four existing transitive packages moved to newer compatible
releases. Review package and lockfile diffs in every dependency slice.

## Critical repository evidence

| Surface | Evidence | Risk |
| --- | --- | --- |
| Cloud credentials | Tracked `dexie-cloud.key`; cloud addon/configuration in `app/data/dexie.ts`; CLI config in `dexie-cloud.json`. | Exposed secrets and continued cloud dependency. |
| Multiple cloud targets | Runtime and CLI configuration point to different Dexie Cloud database URLs. | An archive or deletion aimed at only one target can miss live data. |
| Hard-coded login | `app/lib/firebase.ts` contains hard-coded credentials. | Credential exposure and undocumented authentication coupling. |
| Public data | `public/goods.json` contains owner/realm identifiers. | Deployed PII/tenant metadata exposure. |
| Destructive import | `app/data/dexie_goods.ts#syncGoods` clears goods before bulk import; `/dev` exposes it. | Accidental local data erasure. |
| Partial sale transaction | `record_dexie_sale` does not await per-product history writes; stock updates are commented out; COH is a separate transaction. | Sale, stock, history, and cash diverge. |
| Partial delete | `deleteSingleSales` starts an unawaited transaction and deletes only the first matching child row. | False success and orphaned sale history. |
| Competing truths | Embedded sale items, `dexieGoodSales`, product `physical`, and daily `dexieCOH` are independently mutable. | No reliable rebuild path. |
| Incorrect COH | `txless_recompute_coh` accumulates every transaction as positive sales and stores overwritable daily totals. | COH does not mean physical drawer cash. |
| UI/persistence coupling | Persistence modules import `react-hot-toast`; components call data functions directly. | Transaction and error behavior cannot be tested cleanly. |
| Prototype sediment | Multiple Goods Out and inventory-table versions plus stale routes remain. | Fixes land in one path while another remains active. |
| SPA command mismatch | Vite config has `ssr: false`, while `start` expects a server build. | Deployment instructions cannot start the produced artifact. |
| No offline shell proof | IndexedDB is local, but no accepted application-shell caching/install strategy exists. | A disconnected device may not cold-start. |

## Worktree warning

At review time, Git reported roughly 118 tracked files modified by apparent
LF/CRLF conversion. Semantic comparison with `--ignore-cr-at-eol` found no
content change in that broad set. Existing untracked `AGENTS.MD` and
`docs/FIRST_REVIEW.md` belong to the user.

Implementors must:

- inspect both normal and CRLF-insensitive diffs;
- avoid repository-wide normalization;
- stage explicit paths, never all changes;
- preserve user-owned untracked files;
- normalize only a file intentionally changed in the current slice.

## What is not yet proven

- type or lint correctness;
- correct sale, stock, or cash behavior;
- transaction atomicity;
- browser persistence, upgrade, or restore;
- credential revocation or cloud archive completeness;
- safe fresh-balance initialization;
- offline application-shell startup;
- custom synchronization;
- multiple production-device operation;
- production deployment or release readiness.
