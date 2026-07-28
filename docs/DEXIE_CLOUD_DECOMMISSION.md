# Dexie Cloud decommissioning

Status: required runbook

The owner has decided to dismantle Dexie Cloud. This runbook separates safe
repository work from external operations that require an authorized human
operator. Removing files from Git does not archive a database, revoke a
credential, delete history, or delete a remote service.

## Immediate safety rules

- Treat every credential already committed to Git as compromised.
- Do not print, copy, test, or use `dexie-cloud.key`.
- Do not run the Dexie Cloud CLI or call an administrative API with repository
  credentials.
- Do not clear a local IndexedDB database or a remote database.
- Do not expose the tracked key or hard-coded credentials in logs, patches,
  tickets, chat, screenshots, or test fixtures.
- Do not assume the CLI and runtime refer to the same cloud database.

The runtime configuration in `app/data/dexie.ts` and `dexie-cloud.json` name
different database URLs. Both targets must be independently identified and
accounted for.

## Roles

### Implementation agent may

- remove current-tree secret/config files without displaying their contents;
- add exact secret/config patterns to `.gitignore`;
- remove hard-coded Firebase login details;
- remove `dexie-cloud-addon`, `db.cloud.configure`, cloud login UI, and cloud
  configuration;
- remove or gate destructive development routes;
- sanitize public catalog artifacts;
- create a separately named plain-Dexie database;
- preserve the old local `goods` database read-only;
- add verification and migration tests;
- document all still-open external actions.

### Authorized operator must

- identify account ownership and every cloud database;
- export and verify remote data;
- rotate/revoke credentials through trusted administrative access;
- review credential activity;
- choose retention and remote deletion dates;
- coordinate any Git-history rewrite and downstream clone cleanup;
- approve de-clouded production deployment.

An implementation agent must stop if any repository task would require an
external credential or destructive remote action.

## Stage 0 — Immediate operator containment

As soon as a trusted account owner is established, the authorized operator:

1. freezes production writes on every known device and records each device's
   last receipt/operation; physically isolate any device that cannot receive
   the instruction;
2. revokes/rotates both exposed Dexie client credentials through trusted admin
   access;
3. resets the hard-coded Firebase account credential, revokes its sessions and
   tokens, and reviews its access;
4. records credential IDs, revocation times, owner, and provider confirmation
   without recording secret values;
5. reviews activity back to the earliest possible exposure and preserves audit
   evidence.

Do not wait for repository cleanup, export completion, or Git-history work to
contain exposed credentials. Use a separate trusted administrator session for
later exports; never copy the committed secrets.

## Stage 1 — Inventory without mutation

Create an operator record containing:

- cloud account/organization owner;
- database ID and display name for each distinct runtime/CLI URL;
- expected tenant/realm count;
- last known write time and approximate record counts by table;
- current application/device users;
- billing owner;
- credential IDs, without secret values;
- source repository revision and application version;
- archival owner and destination.

Confirm whether both configured databases contain unique or overlapping data.
Do not infer this from URL names.

## Stage 2 — Archive and restoration proof

Using trusted administrative access that is not copied from the repository:

1. Confirm the Stage 0 write freeze and last-receipt record.
2. Export every table and metadata needed to interpret it from both remote
   targets.
3. Export the legacy IndexedDB database from every known device/browser
   profile. If a structured export is unavailable, preserve an encrypted full
   profile/storage image and document the exception; never clear the profile.
4. Store every remote and local export in an encrypted, access-controlled
   archive.
5. Record file size, row counts where available, export time, database/device
   identity, last receipt, and SHA-256.
6. Restore each structured remote and local archive into an isolated
   non-production environment. Prove that any full-profile image can be mounted
   or recovered with the recorded application/browser version.
7. Compare table counts, representative relationships, date ranges, and
   checksums where supported.
8. Record each restoration procedure and result.
9. Mark the archives reference-only. They are not inputs to automatic
   fresh-balance migration.

Repository work may continue while this is arranged, but the de-clouded build
must not replace production until the operator confirms archive and restore
evidence.

## Stage 3 — Repository containment

Perform as separate reviewable slices:

1. Add `dexie-cloud.key` and any local cloud configuration to `.gitignore`.
2. Remove `dexie-cloud.key` from the current Git tree without reading it.
3. Remove hard-coded Firebase credentials and unused Firebase coupling.
4. Remove or sanitize `public/goods.json`; no owner email, realm, cloud ID, or
   personal identifier may remain under `public`.
5. Remove `/dev` login, export, clear, and import/sync paths from production
   reachability.
6. Invalidate/purge already deployed or CDN-cached copies of the public JSON
   where applicable.
7. Build and prove the stable, separately named replacement database and UI
   while the legacy path stays quarantined.
8. Switch active runtime composition to the replacement with no dual write.
9. In a following cleanup-only slice, remove `dexie-cloud-addon` imports,
   `db.cloud.configure`, the addon dependency, login/config modules, and cloud
   configuration artifacts.

Do not dual-write to cloud and local schemas. Do not repurpose the old
database name for the replacement. Do not remove the addon early by opening
plain Dexie against legacy `goods`.

Safe filename/reference checks include:

```sh
git ls-files '*dexie-cloud*'
git grep -l -E 'dexie-cloud|db\.cloud|clientSecret|realmId|owner' -- \
  app package.json package-lock.json vite.config.ts dexie-cloud.json
npm ls dexie-cloud-addon
```

The scoped runtime/config search intentionally excludes normative
documentation. Review every returned filename without emitting secret values.
Searches are evidence of repository state, not proof of remote revocation.

## Stage 4 — Service shutdown

The authorized operator:

1. Confirms Stage 0 credential/session revocation and audit evidence.
2. Revokes any additional obsolete users, clients, and automation found during
   inventory.
3. Confirms the de-clouded build no longer sends traffic.
4. Watches for unexpected cloud requests during an agreed observation period.
5. Disables billing/service access if appropriate.
6. Deletes remote databases only after archive restoration, retention,
   legal/business approval, and rollback-window sign-off.
7. Records provider confirmation and deletion date.

Credential revocation should not wait for a Git-history cleanup. If the
operator cannot archive without using an exposed client secret, escalate to
the provider/account administrator.

## Git history

Removing the key from the current tree leaves it in history. A history rewrite
is a separate disruptive operation requiring explicit authorization and
coordination with every clone, fork, open branch, CI cache, artifact store, and
deployment system.

The normal implementation workflow must not:

- run a history rewrite;
- force-push;
- delete tags or release artifacts;
- claim history is clean because the current file is gone.

Revoked credentials reduce risk even when historical copies remain.

## Local legacy database

The browser's old `goods` IndexedDB database is distinct from remote cloud
shutdown. The replacement application must not clear or upgrade it. Preserve
it read-only until:

- cloud and local archives are verified;
- the fresh-balance cutover is accepted;
- the retention window expires;
- the operator explicitly authorizes disposal.

If an export reader is required, build a separate, read-only, user-invoked
tool. It must never run on normal application startup.

## Deployment exit checklist

- [ ] Both configured cloud targets positively identified.
- [ ] Complete exports stored with hashes and metadata.
- [ ] Every known device/browser legacy database or profile is archived.
- [ ] Each remote and local export restored successfully in isolation, or a
      documented full-profile recovery exception is approved.
- [ ] Dexie and Firebase credentials/sessions revoked and activity reviewed.
- [ ] Current-tree secrets and hard-coded credentials removed.
- [ ] Public identifiers sanitized and deployed cached copies invalidated.
- [ ] Destructive `/dev` paths removed or unreachable in production.
- [ ] Dexie Cloud addon/config/login dependency absent.
- [ ] Replacement database uses a new name.
- [ ] No unexpected cloud traffic during observation.
- [ ] Remote retention/deletion decision recorded.
- [ ] Git-history status recorded honestly.
- [ ] Operator approves production decommission.

Record who confirmed each item, when, and where the evidence is stored. Do not
put private exports or credential material in this repository.

## Rollback

Rollback never means deleting evidence or re-enabling exposed credentials.

- Preserve the old deployment artifact and cloud archives under access
  control.
- If the new local release fails before production writes, restore the prior
  deployment only if its credentials and access are made safe by the operator.
- If the new release has accepted writes, stop entry, export the new local
  database, and reconcile explicitly. Never overwrite it with legacy data.
- A rollback decision does not change the fresh-balance policy.
