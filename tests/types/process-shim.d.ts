/** Minimal Node process typing for the isolated regression compiler; production uses @types/node. */
declare const process: { env: Record<string, string | undefined> };
