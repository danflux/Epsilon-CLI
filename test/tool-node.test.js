import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AIMessage, HumanMessage, ToolMessage } from "langchain";
import { ToolNode } from "../src/ai/graph/node.js";
import { getWorkspaceRoot, setWorkspaceRoot } from "../src/utils/workspace.js";

/** Build the minimal graph state the tool node reads. */
function stateWith(toolCalls) {
  return {
    messages: [
      new HumanMessage("please do the thing"),
      new AIMessage({ content: "", tool_calls: toolCalls }),
    ],
  };
}

/**
 * A throwaway directory that is also the workspace root for the case. The file
 * tools are confined to the workspace root, so a case that reads or writes in
 * `os.tmpdir()` while the root is the repo would be refused by policy instead
 * of exercising the tool.
 */
async function tempDir(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "epsilon-test-"));
  const previousRoot = getWorkspaceRoot();

  setWorkspaceRoot(dir);

  t.after(async () => {
    setWorkspaceRoot(previousRoot);
    await fs.rm(dir, { recursive: true, force: true });
  });

  return dir;
}

/** Replies are always the messages after the human + AI pair. */
function replies(result) {
  return result.messages.slice(2);
}

test("an unknown tool is answered instead of throwing (D2)", async () => {
  const result = await ToolNode(
    stateWith([{ id: "call_missing", name: "deleteEverything", args: {} }]),
    {},
  );

  assert.ok(Array.isArray(result.messages), "ToolNode must return { messages }");
  assert.equal(result.messages.length, 3);

  const [reply] = replies(result);
  assert.ok(reply instanceof ToolMessage);
  assert.equal(reply.tool_call_id, "call_missing");
  assert.equal(JSON.parse(reply.content).code, "UNKNOWN_TOOL");
});

test("a multi-call response answers every tool_call_id (D3)", async (t) => {
  const dir = await tempDir(t);

  const result = await ToolNode(
    stateWith([
      {
        id: "call_read",
        name: "readFiles",
        args: { files: [{ path: path.join(dir, "missing.txt") }] },
      },
      { id: "call_bad", name: "noSuchTool", args: {} },
    ]),
    {},
  );

  assert.equal(result.messages.length, 4);

  const ids = replies(result)
    .map((message) => message.tool_call_id)
    .sort();

  assert.deepEqual(ids, ["call_bad", "call_read"]);

  // The failing read must surface as a tool error, not an unhandled throw.
  const failed = replies(result).find((m) => m.tool_call_id === "call_read");
  assert.equal(JSON.parse(failed.content).code, "TOOL_FAILED");
});

test("declining a write answers the call and leaves the workspace untouched (D1)", async (t) => {
  const dir = await tempDir(t);
  const target = path.join(dir, "should-not-exist.txt");

  const result = await ToolNode(
    stateWith([
      {
        id: "call_write",
        name: "upsertFiles",
        args: { files: [{ path: target, content: "written" }] },
      },
    ]),
    { configurable: { approve: async () => false } },
  );

  assert.ok(Array.isArray(result.messages));

  const [reply] = replies(result);
  assert.equal(reply.tool_call_id, "call_write");
  assert.equal(JSON.parse(reply.content).code, "USER_DECLINED");
  await assert.rejects(fs.access(target), "declined write must not touch disk");
});

test("approving a write executes it", async (t) => {
  const dir = await tempDir(t);
  const target = path.join(dir, "created.txt");

  await ToolNode(
    stateWith([
      {
        id: "call_write",
        name: "upsertFiles",
        args: { files: [{ path: target, content: "written" }] },
      },
    ]),
    { configurable: { approve: async () => true } },
  );

  assert.equal(await fs.readFile(target, "utf-8"), "written");
});

test("listFiles returns paths (D4: missing path import)", async (t) => {
  const dir = await tempDir(t);
  await fs.writeFile(path.join(dir, "note.txt"), "hi");

  const result = await ToolNode(
    stateWith([{ id: "call_list", name: "listFiles", args: { folder: dir } }]),
    {},
  );

  const [reply] = replies(result);
  const listed = JSON.parse(reply.content);

  assert.ok(Array.isArray(listed));
  assert.ok(
    listed.some((entry) => entry.endsWith("note.txt")),
    `expected note.txt in ${JSON.stringify(listed)}`,
  );
});

test("calls beyond the per-turn cap are still answered", async () => {
  const toolCalls = Array.from({ length: 10 }, (_, index) => ({
    id: `call_${index}`,
    name: "noSuchTool",
    args: {},
  }));

  const result = await ToolNode(stateWith(toolCalls), {});

  assert.equal(result.messages.length, 12, "every call needs one reply");

  const codes = replies(result).map((message) => JSON.parse(message.content).code);
  assert.equal(codes.filter((code) => code === "UNKNOWN_TOOL").length, 8);
  assert.equal(codes.filter((code) => code === "TOOL_LIMIT").length, 2);
});
