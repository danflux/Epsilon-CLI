import { ChatGroq } from "@langchain/groq";
import { ToolMessage } from "langchain";
import * as fileTools from "../tools/files.tool.js";
import { policyCodeOf } from "../tools/policy.js";
import { getReadline } from "../../utils/readline.js";

const MODEL_ID = "openai/gpt-oss-120b";

/** Tools exposed to the model. */
const TOOLS = [fileTools.upsertFiles, fileTools.readFiles, fileTools.listFiles];

const TOOLS_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

/** Tools that change the workspace and therefore need human approval. */
const APPROVAL_REQUIRED = new Set(["upsertFiles"]);

/** Cap on tool calls executed for a single model response. */
const MAX_TOOL_CALLS_PER_TURN = 8;

let cachedModel = null;
let cachedApiKey = null;

/** Build the model once per key instead of once per graph step. */
function getModel(apiKey) {
  if (!apiKey) {
    throw new Error("No API key was provided to the model node.");
  }

  if (!cachedModel || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    cachedModel = new ChatGroq({ model: MODEL_ID, apiKey }).bindTools(TOOLS);
  }

  return cachedModel;
}

/**
 * Every reply to a tool call must carry the originating `tool_call_id`.
 * The provider rejects the next request if any call is left unanswered, so
 * this message is always constructed explicitly rather than derived.
 */
function toolReply(toolCall, payload) {
  return new ToolMessage({
    tool_call_id: toolCall?.id ?? "unknown",
    content: JSON.stringify(payload),
  });
}

function describeTarget(toolCall) {
  const files = toolCall?.args?.files;

  if (Array.isArray(files)) {
    return files.map((file) => file?.path ?? "?").join(", ");
  }

  return JSON.stringify(toolCall?.args ?? {});
}

async function askForApproval(toolCall) {
  console.log(`\n[Approval] ${toolCall.name} would modify: ${describeTarget(toolCall)}`);

  const answer = await getReadline().question("[Approval] Proceed? (yes/no): ");

  return answer.trim().toLowerCase() === "yes";
}

/**
 * Handles the LLM node logic for the state graph.
 * @param {Object} state - The current state of the graph.
 * @param {Object} [config] - LangGraph node config; carries the API key.
 * @returns {Promise<Object>} - The updated state after processing.
 */
export async function LLMNode(state, config) {
  const model = getModel(config?.configurable?.apiKey);
  const stream = await model.stream(state.messages);

  let aiMessage = null;

  for await (const chunk of stream) {
    const text = chunk.text ?? "";

    if (text) {
      process.stdout.write(text);
    }

    aiMessage = aiMessage ? aiMessage.concat(chunk) : chunk;
  }

  process.stdout.write("\n");

  // A response with no content and no tool calls must not append `null`.
  if (!aiMessage) {
    return { messages: state.messages };
  }

  return {
    messages: [...state.messages, aiMessage],
  };
}

/**
 * Execute every tool call from the last AI message.
 *
 * Contract: this node always returns `{ messages }` and always appends exactly
 * one `ToolMessage` per `tool_call_id` — including unknown tools, declined
 * approvals, failures, and calls beyond the per-turn cap. Returning a bare
 * message or skipping a call leaves the history invalid and every following
 * request fails.
 *
 * @param {Object} state - The current state of the graph.
 * @param {Object} [config] - LangGraph node config; `configurable.approve`
 *   overrides the interactive approval prompt (used by tests).
 * @returns {Promise<Object>} - The updated state.
 */
export async function ToolNode(state, config) {
  const messages = state.messages ?? [];
  const lastMessage = messages[messages.length - 1];
  const toolCalls = lastMessage?.tool_calls ?? [];

  /** @type {(toolCall: Object) => Promise<boolean>} */
  const approve = config?.configurable?.approve ?? askForApproval;

  const executed = toolCalls.slice(0, MAX_TOOL_CALLS_PER_TURN);
  const skipped = toolCalls.slice(MAX_TOOL_CALLS_PER_TURN);

  const toolResults = [];

  for (const toolCall of executed) {
    const tool = TOOLS_BY_NAME.get(toolCall?.name);

    if (!tool) {
      toolResults.push(
        toolReply(toolCall, {
          ok: false,
          code: "UNKNOWN_TOOL",
          error: `No tool named "${toolCall?.name}". Available tools: ${[
            ...TOOLS_BY_NAME.keys(),
          ].join(", ")}.`,
        }),
      );
      continue;
    }

    if (APPROVAL_REQUIRED.has(tool.name) && !(await approve(toolCall))) {
      toolResults.push(
        toolReply(toolCall, {
          ok: false,
          code: "USER_DECLINED",
          error:
            "The user declined this operation. The workspace was not modified. Do not retry it; ask the user what to do instead.",
        }),
      );
      continue;
    }

    console.log(`[Tool] ${tool.name}(${describeTarget(toolCall)})`);

    try {
      const raw = await tool.invoke(toolCall.args ?? {});
      const content = typeof raw === "string" ? raw : raw?.content;

      toolResults.push(
        new ToolMessage({
          tool_call_id: toolCall?.id ?? "unknown",
          name: tool.name,
          content:
            typeof content === "string"
              ? content
              : JSON.stringify(content ?? null),
        }),
      );
    } catch (error) {
      const payload = {
        ok: false,
        code: "TOOL_FAILED",
        error: error?.message ?? String(error),
      };

      // A policy refusal keeps `TOOL_FAILED` as its category so every failure is
      // handled in one place, but carries its precise code so the model can say
      // why the path was refused instead of guessing.
      const policyCode = policyCodeOf(error);

      if (policyCode) {
        payload.policyCode = policyCode;
      }

      toolResults.push(toolReply(toolCall, payload));
    }
  }

  // Calls over the cap still need an answer, for the same reason as above.
  for (const toolCall of skipped) {
    toolResults.push(
      toolReply(toolCall, {
        ok: false,
        code: "TOOL_LIMIT",
        error: `At most ${MAX_TOOL_CALLS_PER_TURN} tool calls run per turn; this one was not executed.`,
      }),
    );
  }

  return {
    messages: [...messages, ...toolResults],
  };
}
