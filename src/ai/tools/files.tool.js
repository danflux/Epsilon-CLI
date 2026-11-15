import { tool } from "langchain";
import * as z from "zod";
import fs from "fs/promises";
import path from "path";
import {
  MAX_FILE_BYTES,
  PolicyError,
  assertNotSensitive,
  clampOutput,
  resolveInWorkspace,
} from "./policy.js";

/**
 * Directories skipped while listing: dependency trees, VCS internals and the
 * configuration directory are never useful output and can be enormous.
 */
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".git", ".epsilon-cli"]);

/**
 * Contain one requested path and refuse sensitive locations.
 * @param {string} requestedPath - Path as sent by the model.
 * @returns {string} Absolute path that is safe to touch.
 */
function authorize(requestedPath) {
  return assertNotSensitive(resolveInWorkspace(requestedPath));
}

/** `fs.stat`, with a missing path reported as a policy refusal. */
async function statOrNotFound(target, requestedPath) {
  try {
    return await fs.stat(target);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      throw new PolicyError(
        "NOT_FOUND",
        `"${requestedPath}" does not exist in the workspace.`,
      );
    }

    throw error;
  }
}

/**
 * Create/Update multiple files at once (create one if not existed)
 * input example:-
 * upsertFiles({
  files: [
    {
      path: "index.js",
      content: 'console.log("Hello")'
    },
    {
      path: "package.json",
      content: '{"name":"app"}'
    }
  ]
})
 */
export const upsertFiles = tool(
  async function ({ files }) {
    await Promise.all(
      files.map(async (file) => {
        const target = authorize(file.path);

        await fs.writeFile(target, file.content);
      }),
    );
    return "file created successfully";
  },
  {
    name: "upsertFiles",
    description:
      "Create/Update multiple files at once (create one if not existed)",
    schema: z.object({
      files: z.array(
        z.object({
          path: z
            .string()
            .describe("absolute path of the file to be created/update"),
          content: z
            .string()
            .describe("content of the file to be created/update"),
        }),
      ),
    }),
  },
);

/**
 * List all the folder (recursively) and files in the current folder (ignore folders like node_modules)
 */
export const listFiles = tool(
  async function ({ folder }) {
    const root = authorize(folder);
    const results = [];

    // funtion for travesrsing folder
    async function traverse(currentFolder) {
      const entries = await fs.readdir(currentFolder, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentFolder, entry.name);

        // Never follow links: a junction inside the workspace can point anywhere.
        if (entry.isSymbolicLink()) continue;

        if (entry.isDirectory()) {
          if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
          await traverse(fullPath);
        } else {
          results.push(fullPath);
        }
      }
    }

    //function call
    await traverse(root);

    return JSON.stringify(results);
  },
  {
    name: "listFiles",
    description:
      "List all the folder (recursively) and files in the current folder (ignore folders like node_modules)",
    schema: z.object({
      folder: z.string().describe("absolute path of the folder to list"),
    }),
  },
);

/**
 * Read the content of multiple files at once
 * excepts input like: 
 * {
        files: [
            { path: "./index.js" },
            { path: "./package.json" }
        ]   
    }
    
    output:
    [
        {
            "path": "./index.js",
            "content": "console.log(\"Hello\");"
        },
        {
            "path": "./package.json",
            "content": "{\"name\":\"demo\"}"
        }
    ]
 */
export const readFiles = tool(
  async function ({ files }) {
    const results = await Promise.all(
      files.map(async (file) => {
        const target = authorize(file.path);
        const stats = await statOrNotFound(target, file.path);

        if (!stats.isFile()) {
          throw new PolicyError(
            "NOT_FOUND",
            `"${file.path}" is not a regular file.`,
          );
        }

        if (stats.size > MAX_FILE_BYTES) {
          throw new PolicyError(
            "TOO_LARGE",
            `"${file.path}" is ${stats.size} bytes, over the ${MAX_FILE_BYTES}-byte limit. Read a smaller file or ask the user to narrow it down.`,
          );
        }

        const content = await fs.readFile(target, "utf-8");

        // Belt and braces: the stat above bounds the read, this bounds the output.
        return { path: file.path, content: clampOutput(content) };
      }),
    );

    return JSON.stringify(results);
  },
  {
    name: "readFiles",
    description: "Read the content of multiple files at once",
    schema: z.object({
      files: z.array(
        z.object({
          path: z.string().describe("absolute path of the file to be read"),
        }),
      ),
    }),
  },
);
