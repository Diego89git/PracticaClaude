// PostToolUse hook (Write|Edit): runs Prettier and ESLint on the touched file.
import { spawnSync } from "node:child_process";
import path from "node:path";

const LINTABLE = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let filePath;
try {
  filePath = JSON.parse(raw)?.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (!filePath) process.exit(0);

const root = path.resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const file = path.resolve(filePath);
const rel = path.relative(root, file);

// Only files inside this project, never dependencies or build output.
if (rel.startsWith("..") || path.isAbsolute(rel)) process.exit(0);
if (/(^|[\\/])(node_modules|\.next|\.git)([\\/]|$)/.test(rel)) process.exit(0);

// Run the local bins with node directly: no shell, so Windows paths need no quoting.
const run = (bin, args) =>
  spawnSync(process.execPath, [path.join(root, "node_modules", bin), ...args], {
    cwd: root,
    encoding: "utf8",
  });

run("prettier/bin/prettier.cjs", ["--write", "--ignore-unknown", file]);

if (LINTABLE.has(path.extname(file).toLowerCase())) {
  const lint = run("eslint/bin/eslint.js", ["--fix", file]);
  if (lint.status !== 0) {
    process.stderr.write(
      `ESLint errors in ${rel}:\n${lint.stdout}${lint.stderr}`,
    );
    process.exit(2);
  }
}
