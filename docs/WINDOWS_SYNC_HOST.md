# Windows synchronization host

Status: implemented host package; operator installation required

This runbook installs the synchronization server on the managed Windows shop
computer. The browser application remains a static offline-capable site. The
Windows computer runs one loopback-only Node process and one SQLite database;
Cloudflare Tunnel supplies HTTPS without opening an inbound router port.

The code and automated backup proof are complete. Domain ownership, the
Windows account, hostname, Cloudflare zone, off-computer backup target, and
production secrets are operator inputs and must never be committed.

## Required operator choices

Record these outside the repository before installation:

- the managed Windows computer and administrator;
- the static application origin, such as
  `https://inventory.example.com`;
- the synchronization hostname, such as
  `https://sync.inventory.example.com`;
- a long shop enrollment password;
- an off-computer backup destination and its access owner;
- the operator responsible for restore drills and device revocation.

The password enrolls the browser once. A successful enrollment creates a
different 256-bit credential for that device and stores it in IndexedDB. The
password is not persisted by the browser. An enrolled Windows/browser profile
can reopen offline without entering the password, so Windows account and disk
security remain part of the lock.

## 1. Prepare the host

Install the Node/npm versions declared in `package.json` and install
`cloudflared` from Cloudflare's official package. Use a managed Windows account
with BitLocker, automatic security updates, and a password-protected screen
lock. Do not share the browser profile used by the application.

From an approved source checkout:

```powershell
npm ci
npm run test
npm run typecheck
npm run lint
npm run build
npm run build:sync
```

`build:sync` starts the generated server on a temporary loopback port and
checks `/health` before succeeding. If an older `sync-server.mjs` reports
`Dynamic require of "node:events" is not supported`, pull the current source
and rebuild it; that artifact predates the required Node ESM compatibility
bridge.

Copy `docs/templates/SYNC_HOST_CONFIG.example.json` outside the checkout as:

```text
C:\ProgramData\InventorySync\host-config.json
```

Create its data directory and a separate UTF-8 password file:

```text
C:\ProgramData\InventorySync\enrollment-password.txt
```

Use a secure editor; do not put the password on a command line or in shell
history. Restrict the directory and both files to Administrators and the
account that runs the service. Confirm the ACL explicitly with `icacls`. The
example configuration intentionally contains placeholders and is not a
production secret.

Set `allowedOrigin` to the exact static application origin. It is a single
origin, not `*`, and has no trailing path. Keep the SQLite database outside the
checkout so an application update cannot replace it.

## 2. Start and verify loopback service

From the checkout, run:

```powershell
node build\sync-server.mjs --config C:\ProgramData\InventorySync\host-config.json
```

In another terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

The server binds `127.0.0.1` only. Do not change it to `0.0.0.0`, create a
router port-forward, or add a public Windows Firewall allow rule. A loopback
health failure stops installation; inspect the service account's read/write
access and the configured port without printing the password.

## 3. Install automatic startup

Create a Windows Task Scheduler task with:

- trigger: at system startup;
- account: the dedicated managed service account;
- action: the absolute Node executable followed by
  `C:\path\to\app\build\sync-server.mjs --config
  C:\ProgramData\InventorySync\host-config.json`;
- start in: the application checkout;
- run whether the user is logged on;
- restart on failure, with a finite delay;
- no parallel second instance.

Restart Windows and repeat the loopback health check. Record the task
definition and successful restart evidence outside the repository.

## 4. Publish through Cloudflare Tunnel

In the operator's Cloudflare account, create a named tunnel and route only the
chosen synchronization hostname to:

```text
http://127.0.0.1:8787
```

Install `cloudflared` as a Windows service using the account-issued token.
Tokens and generated tunnel credentials stay outside the repository and logs.
Do not paste them into issue trackers or acceptance records. Configure the
tunnel and DNS under the operator's real zone, then verify:

```powershell
Invoke-RestMethod https://sync.inventory.example.com/health
```

The application must be built with the matching HTTPS synchronization URL,
or the operator can enter that URL during first enrollment. The server CORS
origin must match the deployed static application origin exactly.

Stopping the tunnel, Node service, or shop computer makes synchronization
temporarily unavailable but does not block local sales. Devices retain their
outboxes and retry on open, every 15 minutes while open, or when **Sync now**
is selected.

## 5. Enroll and revoke devices

The first device must already contain the approved fresh location opening. On
its enrollment screen choose first-shop enrollment, verify the location,
device, and drawer labels, and enter the shop password. Later devices choose
join-shop enrollment and receive canonical location settings.

Every physical device gets one unique device code, one drawer, one browser
profile, and one credential. Never clone an enrolled browser profile. A local
backup intentionally excludes the synchronization credential.

Joining enrollment atomically creates a hashed, immutable PHP 0.00 drawer
opening. Put physical cash into that drawer only through a normal deposit in
the app. For planned replacement, synchronize withdrawals until the old
drawer shows PHP 0.00, then call the password-protected `decommission`
endpoint. The server rejects planned decommissioning while its projected
drawer COH is nonzero.

To revoke a lost device, an authorized operator calls the password-protected
revocation endpoint while the server is reachable. Revocation takes effect
when that device reconnects; it cannot disable a device that remains offline.
Preserve its directory record for historical receipt and drawer labels.

## 6. Create daily off-computer backups

Build the server package first, then test a backup to an access-controlled
off-computer destination:

```powershell
node build\sync-backup.mjs --config C:\ProgramData\InventorySync\host-config.json --destination \\backup-host\InventorySync
```

The command uses SQLite `VACUUM INTO` to create a consistent snapshot while
the server is live. It then runs `PRAGMA integrity_check` and writes a JSON
sidecar containing the timestamp and SHA-256 hash. Any failure exits nonzero
and must alert the operator; an incomplete target is removed.

Schedule this command daily in Task Scheduler after the off-computer target is
available. A local second disk in the same computer is not off-computer
backup. Apply the approved retention policy to both `.sqlite` and `.json`
files together; the recommended minimum is 30 daily copies plus 12 month-end
copies. Encrypt and access-control the destination.

## 7. Prove restore before rollout

At least once before production and then quarterly:

1. Select a backup and verify its sidecar SHA-256.
2. Copy it to an isolated drill directory; never overwrite the live database.
3. Copy the host configuration and point `databasePath` to the drill copy and
   `port` to an unused loopback port.
4. Start the server with that drill configuration and the same protected
   password file.
5. Verify `/health`, authenticate an approved test/recovered identity, and
   reconcile device directory, aggregate counts, cursors, and an idempotent
   retry.
6. Stop the drill server and retain the signed result outside the repository.

An actual live restore is a controlled incident: stop the sync task and
tunnel, preserve the current database and WAL files as evidence, verify the
selected backup/hash in isolation, replace the configured database only with
explicit operator approval, restart, reconcile, and then reopen the tunnel.

## Go-live evidence

Production multi-device operation remains blocked until all are true:

- local/staging acceptance and fresh-balance cutover are signed;
- Node and tunnel survive a Windows restart;
- loopback and public HTTPS health checks pass;
- direct inbound exposure is absent;
- each device has a unique identity/drawer and can reopen offline;
- simultaneous offline sales converge with overselling allowed;
- product conflicts can be resolved from the UI;
- a daily off-computer backup and isolated restore drill pass;
- lost-device revocation and outage behavior are rehearsed;
- Dexie Cloud external archive/revocation/decommission steps are complete.

Repository tests cannot manufacture these physical, credential, Cloudflare,
or backup-custody facts. Store the evidence record outside the application and
do not include secrets.
