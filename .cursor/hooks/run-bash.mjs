#!/usr/bin/env node
// Cross-platform entry for bash hook scripts.
// Windows Cursor runs hooks via PowerShell (so bare .sh / .cmd paths are not portable).
// Linux CI can exec .sh, but not .cmd (exit 126). Node is on PATH in both places;
// this launcher finds bash and forwards stdin/stdout/stderr unchanged.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const name = process.argv[2];
if (!name || !/^[a-z0-9-]+$/i.test(name)) {
  console.error('run-bash: usage: node run-bash.mjs <hook-name>');
  process.exit(1);
}

const dir = dirname(fileURLToPath(import.meta.url));
const script = join(dir, `${name}.sh`);
if (!existsSync(script)) {
  console.error(`run-bash: not found: ${script}`);
  process.exit(1);
}

function resolveBash() {
  if (process.platform !== 'win32') {
    return 'bash';
  }
  const candidates = [
    join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
    join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return 'bash';
}

const result = spawnSync(resolveBash(), ['--noprofile', '--norc', script], {
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error) {
  console.error(`run-bash: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
