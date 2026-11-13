const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const buildDir = path.join(root, ".test-build");
const sourceFiles = [
  "lib/trip-planner/types.ts",
  "lib/trip-planner/destinations.ts",
  "lib/trip-planner/airports.ts",
  "lib/trip-planner/flight-routing.ts",
  "lib/trip-planner/flight-search-params.ts",
  "lib/trip-planner/flexible-flight-dates.ts",
  "lib/trip-planner/flight-search-policy.ts",
  "lib/trip-planner/flight-booking-url.ts",
  "lib/trip-planner/geoapify-format.ts",
  "lib/trip-planner/location-suggestions.ts",
  "lib/trip-planner/cost-ledger.ts",
  "lib/trip-planner/validation.ts",
  "lib/ai/search-preferences.ts",
];

function run(command, args) {
  return spawnSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
}

fs.rmSync(buildDir, { recursive: true, force: true });
try {
  const compile = run("tsc", [
    "--target", "ES2022",
    "--module", "commonjs",
    "--moduleResolution", "node",
    "--strict",
    "--skipLibCheck",
    "--esModuleInterop",
    "--rootDir", ".",
    "--outDir", ".test-build",
    ...sourceFiles,
  ]);
  if (compile.error || compile.status !== 0) {
    process.exitCode = compile.status || 1;
  } else {
    const testFiles = fs.readdirSync(path.join(root, "tests", "regression"))
      .filter((name) => name.endsWith(".test.cjs"))
      .sort()
      .map((name) => path.join("tests", "regression", name));
    if (!testFiles.length) {
      console.error("No regression test files were found.");
      process.exitCode = 1;
    } else {
      const result = run(process.execPath, ["--test", ...testFiles]);
      process.exitCode = result.status || 0;
      if (result.error) {
        console.error(result.error.message);
        process.exitCode = 1;
      }
    }
  }
} finally {
  fs.rmSync(buildDir, { recursive: true, force: true });
}
