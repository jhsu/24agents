#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import Redis from "ioredis";

type Options = {
  filePath: string;
  channel: string;
  redisUrl: string;
  delayMs: number;
  startLine: number;
  endLine?: number;
  limit?: number;
  dryRun: boolean;
};

function parseIntArg(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid value for ${flag}: ${value}`);
  }
  return parsed;
}

function parseArgs(argv: string[]): Options {
  let filePath = path.resolve(process.cwd(), "claude.log");
  let channel = "claude-code:log";
  let redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  let delayMs = 0;
  let startLine = 1;
  let endLine: number | undefined;
  let limit: number | undefined;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (!next) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === "--file") {
      filePath = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }

    if (arg === "--channel") {
      channel = next;
      i += 1;
      continue;
    }

    if (arg === "--redis-url") {
      redisUrl = next;
      i += 1;
      continue;
    }

    if (arg === "--delay-ms") {
      delayMs = parseIntArg(next, arg);
      i += 1;
      continue;
    }

    if (arg === "--start-line") {
      startLine = Math.max(1, parseIntArg(next, arg));
      i += 1;
      continue;
    }

    if (arg === "--end-line") {
      endLine = Math.max(1, parseIntArg(next, arg));
      i += 1;
      continue;
    }

    if (arg === "--limit") {
      limit = parseIntArg(next, arg);
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    filePath,
    channel,
    redisUrl,
    delayMs,
    startLine,
    endLine,
    limit,
    dryRun,
  };
}

function printHelp() {
  console.log(`Replay claude.log JSON lines to Redis pub/sub.

Usage:
  bun run src/bun/replayClaudeLog.ts [options]

Options:
  --file <path>         Path to log file (default: ./claude.log)
  --channel <name>      Redis channel (default: claude-code:log)
  --redis-url <url>     Redis URL (default: REDIS_URL or redis://127.0.0.1:6379)
  --delay-ms <n>        Delay between publishes in ms (default: 0)
  --start-line <n>      First line to replay, 1-based (default: 1)
  --end-line <n>        Last line to replay, inclusive
  --limit <n>           Max number of lines to publish after filters
  --dry-run             Parse and count lines without publishing
  --help                Show this help
`);
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(options.filePath)) {
    throw new Error(`Log file not found: ${options.filePath}`);
  }

  if (
    options.endLine !== undefined &&
    options.endLine > 0 &&
    options.endLine < options.startLine
  ) {
    throw new Error("--end-line must be >= --start-line");
  }

  const redis = options.dryRun
    ? null
    : new Redis(options.redisUrl, { maxRetriesPerRequest: null });

  let seen = 0;
  let published = 0;
  let invalid = 0;

  const input = fs.createReadStream(options.filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ crlfDelay: Number.POSITIVE_INFINITY, input });

  for await (const line of rl) {
    seen += 1;

    if (seen < options.startLine) {
      continue;
    }
    if (options.endLine !== undefined && seen > options.endLine) {
      break;
    }
    if (options.limit !== undefined && published >= options.limit) {
      break;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      JSON.parse(trimmed);
    } catch {
      invalid += 1;
      continue;
    }

    if (!options.dryRun && redis) {
      await redis.publish(options.channel, trimmed);
      if (options.delayMs > 0) {
        await sleep(options.delayMs);
      }
    }

    published += 1;
  }

  await redis?.quit();

  console.log(
    `Replay complete. seen=${seen} published=${published} invalid=${invalid} channel=${options.channel} dryRun=${options.dryRun}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
