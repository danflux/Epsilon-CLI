import readline from "readline/promises";

/** @type {import("node:readline/promises").Interface | null} */
let iface = null;

/**
 * Return the shared CLI prompt interface, creating it on first use.
 *
 * This is lazy on purpose: creating a readline interface attaches
 * `process.stdin`, which keeps a process alive. Importing a module must never
 * do that, otherwise tests and one-shot runs hang waiting on stdin.
 */
export function getReadline() {
  if (!iface) {
    iface = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  return iface;
}

/** Close the shared interface if it was ever opened. Safe to call twice. */
export function closeReadline() {
  if (iface) {
    iface.close();
    iface = null;
  }
}
