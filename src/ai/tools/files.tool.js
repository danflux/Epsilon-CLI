import { tool } from "langchain";
import * as z from "zod";
import fs from "fs/promises";
import path from "path";

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
      files.map((file) => fs.writeFile(file.path, file.content)),
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
    const results = [];

    // funtion for travesrsing folder
    async function traverse(currentFolder) {
      const entries = await fs.readdir(currentFolder, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentFolder, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules") continue;
          await traverse(fullPath);
        } else {
          results.push(fullPath);
        }
      }
    }

    //function call
    await traverse(folder);

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
        const content = await fs.readFile(file.path, "utf-8");
        return { path: file.path, content };
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
