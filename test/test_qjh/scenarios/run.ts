import path from "node:path";
import { fileURLToPath } from "node:url";

import { runScenarioFile } from "./data-driven.js";

const DEFAULT_SCENARIO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "data/default.json"
);

function getScenarioPath() {
  const scenarioFromEnv = process.env.SCENARIO_FILE ?? process.env.npm_config_scenario;
  return scenarioFromEnv ? path.resolve(scenarioFromEnv) : DEFAULT_SCENARIO;
}

async function main() {
  const scenarioPath = getScenarioPath();
  console.log("Using scenario file:", scenarioPath);
  await runScenarioFile(scenarioPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});