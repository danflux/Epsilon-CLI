import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AIMessage, HumanMessage } from "langchain";
import { ToolNode } from "../src/ai/graph/node.js";
import { listFiles, readFiles, upsertFiles } from "../src/ai/tools/files.tool.js";
import {
  MAX_FILE_BYTES,
  PolicyError,
  assertNotSensitive,
  clampOutput,
  policyCodeOf,
  resolveInWorkspace,
} from "../src/ai/tools/policy.js";
import { getWorkspaceRoot, setWorkspaceRoot } from "../src/utils/workspace.js";

/**
 * A throwaway directory that becomes the workspace root for the case.
 * The previous root is restored afterwards so cases stay independent.
 */
async function workspace(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "epsilon-policy-"));
  const previousRoot = getWorkspaceRoot();

  setWorkspaceRoot(dir);

  t.after(async () => {
    setWorkspaceRoot(previousRoot);
    await fs.rm(dir, { recursive: true, force: true });
  });

  return dir;
}

/** Run a synchronous check and return the policy code it raised, if any. */
function codeOf(check) {
  try {
    check();
  } catch (error) {
    return error instanceof PolicyError ? error.code : `UNEXPECTED: ${error?.message}`;
  }

  return "NO_THROW";
}

/**
 * Await a tool call and report the refusal it produced. Tools may re-wrap errors,
 * so the code is recovered through `policyCodeOf` rather than read directly.
 */
async function refusal(promise) {
  try {
    await promise;
  } catch (error) {
    return { code: policyCodeOf(error), message: error?.message ?? String(error) };
  }

  return { code: "NO_THROW", message: "" };
}

/**
 * Create a directory link inside the workspace.
 * A junction needs no elevation on Windows, unlike a plain symlink; on a locked
 * down account this returns false and the caller skips instead of failing.
 */
async function tryLink(target, link) {
  try {
    await fs.symlink(target, link, path.sep === "\\" ? "junction" : "dir");
    return true;
  } catch {
    return false;
  }
}

test("relative paths that escape the workspace are rejected", async (t) => {
  await workspace(t);

  assert.equal(
    codeOf(() => resolveInWorkspace(`..${path.sep}outside.txt`)),
    "PATH_OUTSIDE_WORKSPACE",
  );

  if (path.sep === "\\") {
    // The Windows form must be caught too, not treated as a file name.
    assert.equal(
      codeOf(() => resolveInWorkspace(String.raw`..\outside.txt`)),
      "PATH_OUTSIDE_WORKSPACE",
    );
  }

  assert.equal(
    codeOf(() => resolveInWorkspace(`src${path.sep}..${path.sep}..${path.sep}outside.txt`)),
    "PATH_OUTSIDE_WORKSPACE",
  );

  // A name that merely starts with dots is not an escape.
  assert.ok(resolveInWorkspace("..notes.txt").endsWith("..notes.txt"));
});

test("absolute paths outside the workspace are rejected", async (t) => {
  const dir = await workspace(t);

  assert.equal(
    codeOf(() => resolveInWorkspace(path.join(dir, "..", "outside.txt"))),
    "PATH_OUTSIDE_WORKSPACE",
  );

  if (path.sep === "\\") {
    assert.equal(
      codeOf(() => resolveInWorkspace("C:\\Windows\\win.ini")),
      "PATH_OUTSIDE_WORKSPACE",
    );
  }

  // The happy path stays absolute and inside.
  const inside = resolveInWorkspace(path.join(dir, "keep.txt"));
  assert.equal(path.dirname(inside), dir);
});

test("configuration and credential paths are refused", async (t) => {
  const dir = await workspace(t);

  const sensitive = [
    ".env",
    ".env.local",
    ".ENV",
    "settings.json",
    ".npmrc",
    "id_rsa",
    path.join(".git", "config"),
    path.join(".epsilon-cli", "settings.json"),
    path.join("certs", "server.pem"),
  ];

  for (const relative of sensitive) {
    const code = codeOf(() => assertNotSensitive(resolveInWorkspace(relative)));

    assert.equal(code, "SENSITIVE_PATH", `${relative} should be refused`);
  }

  // Ordinary workspace files are untouched.
  const allowed = assertNotSensitive(resolveInWorkspace(path.join("src", "index.js")));
  assert.equal(allowed, path.join(dir, "src", "index.js"));
});

test("readFiles refuses the settings file instead of returning the key", async (t) => {
  const dir = await workspace(t);
  const settings = path.join(dir, "settings.json");

  await fs.writeFile(settings, JSON.stringify({ apiKey: "gsk_should_never_leave" }));

  const { code, message } = await refusal(
    readFiles.invoke({ files: [{ path: settings }] }),
  );

  assert.equal(code, "SENSITIVE_PATH");
  assert.ok(!message.includes("gsk_should_never_leave"), "the refusal must not echo the key");
});

test("writes outside the workspace are refused", async (t) => {
  const dir = await workspace(t);
  const target = path.join(dir, "..", "epsilon-policy-should-not-exist.txt");

  const { code } = await refusal(
    upsertFiles.invoke({ files: [{ path: target, content: "written" }] }),
  );

  assert.equal(code, "PATH_OUTSIDE_WORKSPACE");
  await assert.rejects(fs.access(target), "a refused write must not touch disk");
});

test("a file over the size limit is refused", async (t) => {
  const dir = await workspace(t);
  const large = path.join(dir, "large.txt");

  await fs.writeFile(large, Buffer.alloc(MAX_FILE_BYTES + 1, 0x61));

  const { code } = await refusal(readFiles.invoke({ files: [{ path: large }] }));

  assert.equal(code, "TOO_LARGE");
});

test("a link that escapes the workspace is rejected", async (t) => {
  const dir = await workspace(t);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "epsilon-policy-outside-"));

  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.writeFile(path.join(outside, "secret.txt"), "outside");

  const link = path.join(dir, "escape");

  if (!(await tryLink(outside, link))) {
    t.skip("cannot create a directory link on this account; escape not verified");
    return;
  }

  const { code } = await refusal(
    readFiles.invoke({ files: [{ path: path.join(link, "secret.txt") }] }),
  );

  assert.equal(code, "PATH_OUTSIDE_WORKSPACE");
});

test("a link cannot launder a protected directory", async (t) => {
  const dir = await workspace(t);
  const protectedDir = path.join(dir, ".git", "hooks");

  await fs.mkdir(protectedDir, { recursive: true });

  if (!(await tryLink(path.join(dir, ".git"), path.join(dir, "vendor")))) {
    t.skip("cannot create a directory link on this account; laundering not verified");
    return;
  }

  // `vendor/hooks` is an innocent name that resolves into `.git`; checking only
  // the requested path would let the model read version-control internals.
  const { code } = await refusal(
    readFiles.invoke({ files: [{ path: path.join(dir, "vendor", "hooks") }] }),
  );

  assert.equal(code, "SENSITIVE_PATH");
});

test("listFiles does not walk a link out of the workspace", async (t) => {
  const dir = await workspace(t);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "epsilon-policy-outside-"));

  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.writeFile(path.join(outside, "hidden.txt"), "outside");
  await fs.writeFile(path.join(dir, "visible.txt"), "inside");

  if (!(await tryLink(outside, path.join(dir, "escape")))) {
    t.skip("cannot create a directory link on this account; escape not verified");
    return;
  }

  const listed = JSON.parse(await listFiles.invoke({ folder: dir }));

  assert.ok(listed.some((entry) => entry.endsWith("visible.txt")));
  assert.ok(
    !listed.some((entry) => entry.includes("hidden.txt")),
    `traversal followed the link: ${JSON.stringify(listed)}`,
  );
});

test("an out-of-workspace read becomes a reply and leaves the session valid", async (t) => {
  await workspace(t);

  const result = await ToolNode(
    {
      messages: [
        new HumanMessage("read it"),
        new AIMessage({
          content: "",
          tool_calls: [
            {
              id: "call_escape",
              name: "readFiles",
              args: { files: [{ path: path.join("..", "outside.txt") }] },
            },
          ],
        }),
      ],
    },
    {},
  );

  assert.ok(Array.isArray(result.messages), "ToolNode must return { messages }");
  assert.equal(result.messages.length, 3);

  const reply = result.messages[2];
  assert.equal(reply.tool_call_id, "call_escape");

  const payload = JSON.parse(reply.content);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "TOOL_FAILED");
  assert.equal(payload.policyCode, "PATH_OUTSIDE_WORKSPACE");
});

test("clampOutput truncates with an explicit marker", () => {
  assert.equal(clampOutput("hello", 10), "hello");

  const clamped = clampOutput("a".repeat(200), 50);

  assert.ok(clamped.startsWith("a".repeat(50)));
  assert.match(clamped, /truncated: kept 50 of 200 bytes/);

  // Never split a multi-byte character in half: "é" is two bytes in UTF-8.
  const multiByte = clampOutput("\u00e9".repeat(10), 5);
  const keptContent = multiByte.split("\n")[0];

  assert.ok(!multiByte.includes("\uFFFD"), "truncation must not emit a replacement character");
  assert.equal(Buffer.byteLength(keptContent, "utf-8"), 4);
});

test("readFiles still reads a normal file inside the workspace", async (t) => {
  const dir = await workspace(t);

  await fs.writeFile(path.join(dir, "note.txt"), "hello");

  const [file] = JSON.parse(
    await readFiles.invoke({ files: [{ path: "note.txt" }] }),
  );

  assert.equal(file.content, "hello");
  assert.equal(file.path, "note.txt");
});
