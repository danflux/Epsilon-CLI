
import fs from "fs/promises";
import { CONFIG_DIR, SETTINGS_FILE } from "./constant.js";
import axios from "axios";

/**
 * Return the content of settings.json file (create if it doesnt exist)
 */
export const getSettingsFile = async () => {
  await fs.mkdir(CONFIG_DIR, { recursive: true });

  try {
    const content = await fs.readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify({}, null, 2), {
        mode: 0o600,
      });
      return {};
    }

    if (error instanceof SyntaxError) {
      throw new Error("Settings file contains invalid JSON.");
    }

    throw error;
  }
};

/**
 * Save settings.
 */
export const saveSettings = async (settings) => {
  await fs.mkdir(CONFIG_DIR, { recursive: true });

  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), {
    mode: 0o600,
  });
};

/**
 * save api key to setting file
 */
export const saveApiKey = async (apiKey) => {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error("API key cannot be empty.");
  }
  const settings = await getSettingsFile();

  settings.apiKey = apiKey.trim();

  await saveSettings(settings);
};

/**
 * @returns get API from the settings file
 */
export const getApiKey = async () => {
  const settings = await getSettingsFile();
  const apiKey = settings.apiKey || null;
  if (!apiKey) {
    throw new Error("Groq API key not found");
  }

  return {
    apiKey,
  };
};


/**
 * @param {apiKey} apiKey 
 * @returns an object { 
    *           valid:...., 
    *           error:....
 *            }
 */
export const validateApiKey = async (apiKey) => {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return {
      valid: false,
      error: "API key cannot be empty.",
    };
  }

  try {
    await axios.get("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      timeout: 10000,
    });

    return { valid: true };
  } catch (error) {
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      return {
        valid: false,
        error: "Invalid or unauthorized API key.",
      };
    }

    if (status) {
      return {
        valid: false,
        error: `Groq API returned HTTP ${status}.`,
      };
    }

    return {
      valid: false,
      error: "Unable to connect to Groq. Check your internet connection.",
    };
  }
};
