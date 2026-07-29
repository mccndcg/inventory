import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const secretRules = [
  {
    id: "PRIVATE_KEY_BLOCK",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    id: "GOOGLE_API_KEY",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    id: "AWS_ACCESS_KEY_ID",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    id: "GITHUB_TOKEN",
    pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  },
];

export function scanText(path, source) {
  return secretRules
    .filter((rule) => rule.pattern.test(source))
    .map((rule) => ({ path, ruleId: rule.id }));
}

export function formatFindings(findings) {
  return findings
    .map(({ path, ruleId }) => `${path}: ${ruleId}`)
    .join("\n");
}

function trackedFiles(repositoryRoot) {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

export function scanRepository(repositoryRoot) {
  return trackedFiles(repositoryRoot).flatMap((path) => {
    const source = readFileSync(resolve(repositoryRoot, path), "utf8");
    return source.includes("\0") ? [] : scanText(path, source);
  });
}

const invokedPath = process.argv[1]
  ? resolve(process.argv[1])
  : undefined;

if (invokedPath === fileURLToPath(import.meta.url)) {
  const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const findings = scanRepository(repositoryRoot);

  if (findings.length > 0) {
    console.error(formatFindings(findings));
    process.exitCode = 1;
  } else {
    console.log("Secret scan passed for tracked files.");
  }
}
