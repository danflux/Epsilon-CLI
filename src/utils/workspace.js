import path from "path";

/**
 * Directory that every file tool is confined to.
 *
 * Resolved lazily: importing this module must not pin a root on its own, so the
 * CLI can set an explicit root at startup and tests can set one per case.
 */
let workspaceRoot = null;

/**
 * @returns {string} Absolute path of the current workspace root.
 */
export function getWorkspaceRoot() {
  if (!workspaceRoot) {
    workspaceRoot = path.resolve(process.cwd());
  }

  return workspaceRoot;
}

/**
 * Pin the workspace root for the rest of the process.
 *
 * Stage 4 replaces the single call site in `main.js` with a `--workspace` flag,
 * which is why the root lives here instead of being read from `process.cwd()`
 * wherever it is needed.
 *
 * @param {string} directory - Directory to confine file access to.
 * @returns {string} The resolved root.
 */
export function setWorkspaceRoot(directory) {
  if (typeof directory !== "string" || !directory.trim()) {
    throw new Error("setWorkspaceRoot requires a non-empty directory path.");
  }

  workspaceRoot = path.resolve(directory);

  return workspaceRoot;
}
