import fs from "fs";
import path from "path";
import { getWorkspaceRoot } from "../../utils/workspace.js";

/** Largest amount of a single file handed to the model, in bytes. */
export const MAX_FILE_BYTES = 256 * 1024;

/** Machine-readable refusal codes; `ToolNode` turns these into tool replies. */
export const POLICY_CODES = new Set([
  "PATH_OUTSIDE_WORKSPACE",
  "SENSITIVE_PATH",
  "TOO_LARGE",
  "NOT_FOUND",
]);

/**
 * A refusal produced by the file-access policy rather than by the filesystem.
 * `code` is stable enough for the model to reason about.
 */
export class PolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PolicyError";
    this.code = code;
  }
}

/**
 * Recover the policy code from an error, including one a tool wrapper re-threw
 * or wrapped in another error. Filesystem errors carry their own codes
 * (`ENOENT`, `EISDIR`), none of which are policy codes.
 *
 * @param {unknown} error
 * @returns {string | null} The policy code, or null for an ordinary failure.
 */
export function policyCodeOf(error) {
  let current = error;

  for (let depth = 0; current && depth < 4; depth += 1) {
    if (current instanceof PolicyError) {
      return current.code;
    }

    if (typeof current.code === "string" && POLICY_CODES.has(current.code)) {
      return current.code;
    }

    current = current.cause;
  }

  return null;
}

/** Directory or file names that must never be read or written by a tool. */
const SENSITIVE_NAMES = new Set([
  ".env",
  ".epsilon-cli",
  ".git",
  ".npmrc",
  "settings.json",
]);

/** Prefixes covering key material and `.env.*` variants such as `.env.local`. */
const SENSITIVE_PREFIXES = [".env.", "id_rsa"];

/** Extensions that always mean private key material. */
const SENSITIVE_EXTENSIONS = [".pem"];

/**
 * Prove `candidate` is inside `base`.
 * @throws {PolicyError} PATH_OUTSIDE_WORKSPACE when it is not.
 */
function assertInside(base, candidate, requestedPath) {
  const relative = path.relative(base, candidate);

  // `relative` is empty for the base itself, and absolute (or `..`-prefixed)
  // whenever the candidate lives on another drive or above the base.
  const inside =
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative));

  if (!inside) {
    throw new PolicyError(
      "PATH_OUTSIDE_WORKSPACE",
      `"${requestedPath}" resolves outside the workspace root (${base}). Only paths inside the workspace are allowed.`,
    );
  }
}

/**
 * Strip the extended-length prefix Windows adds for long paths, so two real
 * paths can be compared and joined with `path` helpers.
 * @param {string} realPath - Path returned by `fs.realpathSync.native`.
 * @returns {string} Path without a `\\?\` / `\\?\UNC\` prefix.
 */
function normalizeRealPath(realPath) {
  if (realPath.startsWith("\\\\?\\UNC\\")) {
    return `\\\\${realPath.slice("\\\\?\\UNC\\".length)}`;
  }

  if (realPath.startsWith("\\\\?\\")) {
    return realPath.slice("\\\\?\\".length);
  }

  return realPath;
}

/**
 * Real path of `target`, falling back to the deepest ancestor that exists.
 *
 * A write target usually does not exist yet, and `fs.realpath` throws for it, so
 * resolving the nearest existing ancestor is the only way to prove that the
 * parent chain a write would land in is still inside the workspace. Without
 * this, a junction inside the root (`<root>\link -> C:\Windows`) escapes the
 * lexical check.
 *
 * `realpathSync.native` is required: the JavaScript implementation resolves
 * symlinks but leaves Windows junctions unresolved (`readlink` raises EINVAL on
 * a reparse point), which is exactly the escape this check exists to catch.
 *
 * @param {string} target - Absolute path, existing or not.
 * @returns {string} Real absolute path.
 */
function realpathOfNearestExisting(target) {
  const missing = [];
  let current = target;

  for (;;) {
    try {
      const real = normalizeRealPath(fs.realpathSync.native(current));

      return missing.length ? path.join(real, ...missing) : real;
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
        // Access denied and friends: containment was already proved lexically.
        return target;
      }

      const parent = path.dirname(current);

      if (parent === current) {
        return target;
      }

      missing.unshift(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Resolve a requested path against the workspace root and prove it stays there,
 * including across symlinks and junctions.
 *
 * @param {string} requestedPath - Absolute or relative path from the model.
 * @param {string} [root] - Workspace root; defaults to the process-wide root.
 * @returns {string} Absolute, contained path.
 * @throws {PolicyError} PATH_OUTSIDE_WORKSPACE for any escaping path.
 */
export function resolveInWorkspace(requestedPath, root = getWorkspaceRoot()) {
  if (typeof requestedPath !== "string" || !requestedPath.trim()) {
    throw new PolicyError(
      "PATH_OUTSIDE_WORKSPACE",
      "A non-empty path string is required.",
    );
  }

  if (requestedPath.includes("\0")) {
    throw new PolicyError(
      "PATH_OUTSIDE_WORKSPACE",
      "That path contains a NUL byte.",
    );
  }

  const base = path.resolve(root);

  // `path.resolve` honours absolute inputs, so an absolute path outside the root
  // is rejected here rather than being silently re-anchored inside it.
  const requested = path.resolve(base, requestedPath);

  assertInside(base, requested, requestedPath);

  // Re-prove containment on real paths; a link inside the root can point out.
  const realBase = realpathOfNearestExisting(base);
  const realRequested = realpathOfNearestExisting(requested);

  assertInside(realBase, realRequested, requestedPath);

  // A link must not launder a protected target either: an ordinary-looking name
  // can point straight at `.env` or at a protected directory inside the root.
  assertNotSensitive(realRequested);

  return requested;
}

/**
 * Refuse configuration, credential and version-control paths.
 *
 * Matched per path segment, so ancestors count: `.git/config` is refused for its
 * `.git` segment even though the file name itself is unremarkable.
 *
 * @param {string} resolvedPath - Absolute path already proven to be contained.
 * @returns {string} The same path, for chaining.
 * @throws {PolicyError} SENSITIVE_PATH.
 */
export function assertNotSensitive(resolvedPath) {
  const resolved = path.resolve(resolvedPath);

  for (const segment of resolved.split(path.sep)) {
    if (!segment) {
      continue;
    }

    // NTFS is case-insensitive, so the check is too.
    const name = segment.toLowerCase();

    const sensitive =
      SENSITIVE_NAMES.has(name) ||
      SENSITIVE_PREFIXES.some((prefix) => name.startsWith(prefix)) ||
      SENSITIVE_EXTENSIONS.some((extension) => name.endsWith(extension));

    if (sensitive) {
      throw new PolicyError(
        "SENSITIVE_PATH",
        `"${resolvedPath}" is a protected path ("${segment}"). Settings, credentials and version-control internals cannot be read or written.`,
      );
    }
  }

  return resolved;
}

/**
 * Bound tool output at a byte budget so one file cannot consume the whole
 * context window.
 *
 * @param {string} text - Text to clamp.
 * @param {number} [maxBytes] - Byte budget for the kept content.
 * @returns {string} Either `text`, or a truncated copy carrying a marker.
 */
export function clampOutput(text, maxBytes = MAX_FILE_BYTES) {
  const buffer = Buffer.from(text, "utf-8");

  if (buffer.length <= maxBytes) {
    return text;
  }

  // Cut on a byte boundary, then drop a trailing partial multi-byte character so
  // the model never receives a replacement character at the seam.
  const kept = new TextDecoder("utf-8")
    .decode(buffer.subarray(0, Math.max(0, maxBytes)))
    .replace(/\uFFFD+$/u, "");

  return `${kept}\n\n…[truncated: kept ${Buffer.byteLength(kept, "utf-8")} of ${buffer.length} bytes]`;
}
