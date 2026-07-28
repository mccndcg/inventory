# Implementor documentation

Status: recovery contract

This directory is the handoff package for an implementation agent. It records
what the application must mean, what must be removed, the order in which work
is safe, and the proof required at each stage.

## Read in this order

1. [Implementation status](IMPLEMENTATION_STATUS.md) — current completed
   surfaces, proof, remaining external blockers, and the next sector.
2. [Product decisions](PRODUCT_DECISIONS.md) — accepted behavior, explicit
   non-goals, architecture guardrails, and decisions still due.
3. [Domain rules](DOMAIN_RULES.md) — authoritative stock, sale, cash, product,
   edit, void, and adjustment semantics.
4. [Architecture](ARCHITECTURE.md) — module boundaries, authority, dependency
   direction, and transaction boundaries.
5. [Data model](DATA_MODEL.md) — target records, indexes, constraints, and
   projections.
6. [Implementation playbook](IMPLEMENTATION_PLAYBOOK.md) — ordered slices,
   prerequisites, exit gates, stop conditions, and commit discipline.
7. [Testing](TESTING.md) — Vitest usage and required test matrix.
8. [Dexie Cloud decommissioning](DEXIE_CLOUD_DECOMMISSION.md) — safe
   repository cleanup and operator-only external actions.
9. [Legacy cloud runtime inventory](CLOUD_RUNTIME_INVENTORY.md) — executable
   cloud references, the production quarantine, and pending external work.
10. [Fresh-balance cutover](CUTOVER.md) — archive, initialization, verification,
    and rollback.
11. [Local release acceptance](LOCAL_ACCEPTANCE.md) — implemented evidence and
    the remaining operator sign-off record and its checked external template.
12. [Static offline deployment](OFFLINE_DEPLOYMENT.md) — hosting, install,
    update/rollback, browser support, persistence, and browser proof.
13. [Sync contract](SYNC_CONTRACT.md) — implemented protocol and remaining
    production rollout gates.
14. [Windows sync host](WINDOWS_SYNC_HOST.md) — Node/SQLite auto-start,
    Cloudflare Tunnel, backup, restore, and commissioning operations.
15. [Legacy replacement map](LEGACY_MAP.md) — old tables, modules, and UI paths
    mapped to removal or replacement.
16. [Operations](OPERATIONS.md) — backup, restore, device identity, offline
    operation, and incidents.
17. [Current baseline](BASELINE.md) — observed repository health and known
    inherited failures.

`FIRST_REVIEW.md` is user-owned historical audit material. It is useful
evidence, but it is not normative. In particular, its recommendation to
prevent negative stock is superseded: overselling is allowed for every
product.

## Precedence

When sources disagree, use this order:

1. the current user instruction;
2. repository `AGENTS.MD`;
3. `PRODUCT_DECISIONS.md`;
4. `DOMAIN_RULES.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, and
   `SYNC_CONTRACT.md`;
5. `IMPLEMENTATION_PLAYBOOK.md`;
6. `BASELINE.md`, `LEGACY_MAP.md`, and `FIRST_REVIEW.md`;
7. behavior inferred from legacy code.

Do not infer desired business behavior from the prototype when a document
defines it explicitly. If a new request conflicts with a locked decision,
record the superseding decision before implementation.

## Vocabulary

- **COH**: physical cash currently present in a drawer.
- **Drawer**: the one physical cash drawer assigned to one device.
- **Location**: the single shared inventory pool in the current scope.
- **Authority table**: a table from which a value can be rebuilt exactly.
- **Projection**: a derived view such as current stock or COH.
- **Opening batch**: the signed-off fresh location stock and authoritative
  cutover-drawer cash set.
- **Origin device**: the device that created a sale or adjustment.
- **Tombstone**: a persisted deletion marker that can synchronize safely.
- **Outbox**: a technical delivery queue, not a business event ledger.

## Documentation maintenance

Every behavioral slice must update the affected contract in the same commit.
Keep decisions and formulas in their owning document and link to them rather
than creating competing descriptions. A document update is not proof that the
implementation, migration, cloud cleanup, or production rollout occurred.
