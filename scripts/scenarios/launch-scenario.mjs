import path from "node:path";
import { spawn } from "node:child_process";

const networkName = process.argv[2] ?? "hardhatMainnet";
const scenarioPath = process.argv[3] ? path.resolve(process.argv[3]) : undefined;

const child = spawn(
  `pnpm exec hardhat run scripts/scenarios/run.ts --network ${networkName}`,
  {
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      ...(scenarioPath ? { SCENARIO_FILE: scenarioPath } : {}),
    },
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});