// Usage: node scripts/with-env.mjs <env-file> -- <command> [args...]
// Reads an env file and runs <command> with those values as environment variables.
// It prints only the NAMES it loaded, never the values.
import dotenv from 'dotenv';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const [envFile, separator, command, ...args] = process.argv.slice(2);

if (!envFile || separator !== '--' || !command) {
  console.error('Usage: node scripts/with-env.mjs <env-file> -- <command> [args...]');
  process.exit(2);
}

const parsed = dotenv.parse(fs.readFileSync(envFile));
console.error(`Loaded from ${envFile}: ${Object.keys(parsed).join(', ')}`);

const result = spawnSync(command, args, {
  stdio: 'inherit',
  env: { ...process.env, ...parsed },
});

process.exit(result.status ?? 1);