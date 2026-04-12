import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { runScenarioFile } from "./scenarios/data-driven.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(testDir, "scenarios", "data");
const scenarioFiles = readdirSync(dataDir)
  .filter((fileName) => fileName.endsWith(".json"))
  .sort();

describe("test_qjh integration scenarios", { concurrency: 1 }, () => {
  for (const scenarioFile of scenarioFiles) {
    it(`runs ${scenarioFile}`, async () => {
      await runScenarioFile(path.join(dataDir, scenarioFile));
    });
  }
});