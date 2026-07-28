# Local release acceptance

Status: automated implementation evidence complete; operator sign-off pending

## Implemented evidence

The fresh-start and recovery behavior is isolated in two reviewable commits:

- `5c3bd04` — zero-based opening draft, canonical report hash, atomic immutable
  finalization, and transaction gating;
- `29b7713` — atomic versioned backup, validation, isolated/same-device restore,
  guarded reset, recovery UI, and embedded build-commit evidence.

The automated suite covers initialization/reload, product CRUD, zero opening
counts, opening stock/cash projections, ordinary adjustments, overselling,
multi-item and zero-price sales, edit/void, COH, tombstones, injected rollback,
backup tampering, schema rejection, restore parity, identity safeguards, and
legacy database isolation. Slice 5.11 adds storage denial/pressure tests and
real Chromium proof for online installation, warm offline reload, full browser
restart across all maintained routes, and an interrupted update that retains
the active shell.

The authoritative repository gate is:

```sh
npm ci
npm run scan:secrets
npm test -- --run
npm run typecheck -- --pretty false
npm run lint
npm run build
npx playwright install chromium
npm run test:offline
```

## Operator acceptance still required

An authorized operator must use sanitized staging data and record:

- location, production device/drawer, recorder, verifier, and approver;
- the exact opening report hash and archived signed evidence;
- the approved encrypted backup destination, custodian, and restore-drill
  evidence;
- physical opening stock and cash parity after close/reopen;
- representative sale, oversell, edit, void, adjustment, COH, and rollback
  results;
- staging Chrome and Edge warm/cold offline results on the actual host/device;
- go/no-go decision, tester, date, application commit, and evidence location.

The automated offline-shell gate passes, but until this report is signed the
code is not a production-release approval. Exactly one device remains
authoritative before custom sync acceptance.
