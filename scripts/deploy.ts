import { network } from "hardhat";
import { deploy } from "./scenarios/deploy.js";

async function main() {
  const { viem } = await network.connect();
  await deploy({ viem, log: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
