/**
 * Agent-friendly CLI helpers.
 *
 * Single-file reference implementation of the conventions in
 * ~/agents/_rules/general/cli.md. Copy this into your repo (e.g.
 * src/lib/agent-cli.ts) and import from it. Zero external dependencies.
 */

import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

// ---------- tty / color ----------

export function isTty(): boolean {
  return Boolean(process.stdout.isTTY);
}

export function noColor(): boolean {
  return Boolean(process.env.NO_COLOR) || !isTty();
}

// ---------- doctor ----------

export type DoctorCheck = {
  name: string;
  check: () => boolean | Promise<boolean>;
  hint?: string;
};

export async function doctorRunner(
  checks: DoctorCheck[],
  opts: { exitOnFail?: boolean } = {},
): Promise<number> {
  const { exitOnFail = true } = opts;
  const width = Math.max(...checks.map((c) => c.name.length), 0);
  let failures = 0;

  for (const c of checks) {
    let ok = false;
    let hint = c.hint ?? "";
    try {
      ok = Boolean(await c.check());
    } catch (e) {
      ok = false;
      hint = `${hint} (${(e as Error).message})`.trim();
    }
    const mark = ok ? "PASS" : "FAIL";
    let line = `  [${mark}] ${c.name.padEnd(width)}`;
    if (!ok && hint) line += `  — ${hint}`;
    process.stderr.write(line + "\n");
    if (!ok) failures += 1;
  }

  if (failures > 0) {
    process.stderr.write(`\ndoctor: ${failures} check(s) failed\n`);
    if (exitOnFail) process.exit(1);
    return 1;
  }
  process.stderr.write("\ndoctor: all checks passed\n");
  return 0;
}

// ---------- stdin / file ----------

export async function readStdinOrFile(arg: string): Promise<string> {
  if (arg === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf-8");
  }
  if (!existsSync(arg)) {
    throw new Error(`file not found: ${arg}`);
  }
  return readFileSync(arg, "utf-8");
}

// ---------- mutation gate ----------

export type ConfirmOpts = {
  dryRun?: boolean;
  yes?: boolean;
  force?: boolean;
  destructive?: boolean;
  preview?: string;
  costEstimate?: string;
};

/**
 * Gate a mutation.
 * - dryRun=true: prints preview + intended action, returns false (do not execute).
 * - yes=true: bypass interactive prompt, returns true.
 * - destructive=true: refuses unless force=true even with yes=true.
 * - Otherwise: reads y/N from stdin.
 *
 * Throws (process.exit) when user declines or flag combination is invalid.
 */
export async function confirmOrAbort(
  prompt: string,
  opts: ConfirmOpts = {},
): Promise<boolean> {
  const {
    dryRun = false,
    yes = false,
    force = false,
    destructive = false,
    preview,
    costEstimate,
  } = opts;

  if (preview) process.stderr.write(`[preview]\n${preview}\n`);
  if (costEstimate) process.stderr.write(`[cost] ${costEstimate}\n`);

  if (dryRun) {
    process.stderr.write(`[dry-run] would: ${prompt}\n`);
    return false;
  }

  if (destructive && !force) {
    process.stderr.write(
      `[refused] ${prompt} — destructive op requires --force\n`,
    );
    process.exit(2);
  }

  if (yes) return true;

  if (!isTty()) {
    process.stderr.write(
      `[refused] ${prompt} — non-interactive shell; pass --yes to confirm\n`,
    );
    process.exit(2);
  }

  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const reply = await new Promise<string>((resolve) =>
    rl.question(`${prompt} [y/N] `, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
  if (!["y", "yes"].includes(reply.trim().toLowerCase())) {
    process.stderr.write("[aborted]\n");
    process.exit(130);
  }
  return true;
}

// ---------- output ----------

export type JsonEnvelope<T = unknown> = {
  status: "ok" | "error";
  command: string;
  data?: T;
  error?: string;
};

/**
 * Write a {status, command, data} envelope to stdout.
 * Canonical shape lifted from phantom-loom. No ANSI, compact by default.
 */
export function emitJson<T = unknown>(envelope: JsonEnvelope<T>): void {
  process.stdout.write(JSON.stringify(envelope) + "\n");
}

/**
 * Echo a file path to STDERR so stdout stays parseable.
 * When --json is set, stdout carries the envelope; path goes to stderr.
 */
export function emitPath(path: string, label = "wrote"): void {
  process.stderr.write(`${label}: ${path}\n`);
}
