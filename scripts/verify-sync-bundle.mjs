import { spawn } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import process from "node:process";

const delay = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function unusedPort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  if (!port) throw new Error("Could not reserve a sync-server smoke port.");
  return port;
}

const temporaryDirectory = mkdtempSync(
  join(tmpdir(), "inventory-sync-bundle-"),
);
const passwordFile = join(temporaryDirectory, "password.txt");
const configFile = join(temporaryDirectory, "host-config.json");
const port = await unusedPort();
writeFileSync(passwordFile, "temporary bundle verification password\n");
writeFileSync(
  configFile,
  JSON.stringify({
    databasePath: join(temporaryDirectory, "sync.sqlite"),
    passwordFile,
    allowedOrigin: "https://inventory.test",
    port,
  }),
);

const child = spawn(
  process.execPath,
  [resolve("build/sync-server.mjs"), "--config", configFile],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let output = "";
child.stdout.on("data", (chunk) => {
  output += String(chunk);
});
child.stderr.on("data", (chunk) => {
  output += String(chunk);
});

try {
  let verified = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      const body = await response.json();
      if (
        response.ok &&
        body?.status === "ok" &&
        body?.protocolVersion === 1
      ) {
        verified = true;
        break;
      }
    } catch {
      await delay(100);
    }
  }
  if (!verified) {
    throw new Error(
      `Built sync server did not pass its runtime health check.\n${output}`,
    );
  }
  process.stdout.write("Built sync server runtime check passed.\n");
} finally {
  if (child.exitCode === null) {
    child.kill();
    await Promise.race([once(child, "exit"), delay(2_000)]);
  }
  if (child.exitCode === null) child.kill("SIGKILL");
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
