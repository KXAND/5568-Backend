import { readFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { before, after, describe, it } from "node:test";

import { runScenarioConfig } from "./scenarios/json-scenario-runner.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(testDir, "scenarios", "data");
const localRpcUrl = "http://127.0.0.1:8545";

const scenarioCases = [
  {
    title: "validates direct liquidation raises HF for the Alice-collateral/Bob-borrow case",
    fileName: "alice-collateral-bob-borrow-direct-liquidation.json",
  },
  {
    title: "validates the full Alice-collateral/Bob-borrow liquidation and recovery workflow",
    fileName: "alice-collateral-bob-borrow-full-pass.json",
  },
  {
    title: "validates incentives accrue and can be claimed after withdraw and repay actions",
    fileName: "incentives-withdraw-repay-claims.json",
  },
] as const;

let hardhatNodeProcess: ChildProcess | undefined;

async function isLocalNodeReady() {
  try {
    const response = await fetch(localRpcUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function waitForLocalNodeReady() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isLocalNodeReady()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Hardhat localhost node did not become ready in time");
}

async function ensureLocalNode() {
  if (await isLocalNodeReady()) {
    return;
  }

  hardhatNodeProcess = spawn("pnpm exec hardhat node", {
    cwd: path.resolve(testDir, "..", ".."),
    shell: true,
    stdio: "ignore",
  });

  hardhatNodeProcess.on("error", (error) => {
    throw error;
  });

  await waitForLocalNodeReady();
}

function stopLocalNode() {
  if (!hardhatNodeProcess) {
    return;
  }

  hardhatNodeProcess.kill();
  hardhatNodeProcess = undefined;
}

function loadScenarioConfig(fileName: string) {
  const filePath = path.join(dataDir, fileName);
  const config = JSON.parse(readFileSync(filePath, "utf8")) as {
    network?: string;
  } & Record<string, unknown>;
  config.network = "localhost";
  return config;
}

async function runScenarioQuietly(fileName: string) {
  const originalLog = console.log;
  console.log = () => {};

  try {
    await runScenarioConfig(loadScenarioConfig(fileName));
  } finally {
    console.log = originalLog;
  }
}

describe("test_qjh integration scenarios", { concurrency: 1 }, () => {
  before(async () => {
    await ensureLocalNode();
  });

  after(() => {
    stopLocalNode();
  });

  for (const scenarioCase of scenarioCases) {
    it(scenarioCase.title, async () => {
      await runScenarioQuietly(scenarioCase.fileName);
    });
  }
});