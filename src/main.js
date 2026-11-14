import initGraph from "./ai/graph/graph.js";
import {
  getSettingsFile,
  saveApiKey,
  validateApiKey,
} from "./utils/file.utils.js";
import { closeReadline, getReadline } from "./utils/readline.js";

async function main() {
  try {
    const settings = await getSettingsFile();
    let apiKey = settings.apiKey;

    // Validate an existing saved key once at startup
    if (apiKey) {
      const validation = await validateApiKey(apiKey);

      if (!validation.valid) {
        console.error(validation.error);
        apiKey = null;
      }
    }

    // Keep asking until the user enters a valid key
    while (!apiKey) {
      const enteredKey = await getReadline().question(
        "Please enter your Groq API key: ",
      );

      const validation = await validateApiKey(enteredKey);

      if (!validation.valid) {
        console.error(validation.error);
        continue;
      }

      await saveApiKey(enteredKey);
      apiKey = enteredKey.trim();

      console.log("API key saved successfully.");
    }

    console.log("API key validated successfully.");
    await initGraph({ apiKey });
  } catch (error) {
    console.error("Application error:", error.message);

    // A fatal startup failure must be visible to the shell, not swallowed.
    process.exitCode = 1;
  } finally {
    closeReadline();
  }
}

export default main;
