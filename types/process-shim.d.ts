/** Minimal Node process typing for the isolated regression compiler; production uses @types/node. */
declare const process: { env: Record<string, string | undefined> };

declare module "node:crypto" {
  interface Hash {
    update(value: string): Hash;
    /** Preserve Node crypto overloads used by application code. */
    digest(): Uint8Array;
    digest(encoding: string): string;
  }
  export function createHash(algorithm: string): Hash;
  export function randomBytes(size: number): { toString(encoding: string): string };
}
