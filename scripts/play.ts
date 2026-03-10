import { network } from "hardhat";

async function main() {
  const publicNetwork = (process.env.SCRIPT_NETWORK ?? "hardhatMainnet") as
    | "hardhatMainnet"
    | "localhost";

  const { viem } = await network.connect({ network: publicNetwork });
  const publicClient = await viem.getPublicClient();

  const contractName = "Counter";
  const contractAddress = process.env.CONTRACT_ADDRESS as `0x${string}` | undefined;
  const contract = contractAddress
    ? await viem.getContractAt(contractName, contractAddress)
    : await viem.deployContract(contractName);

  // Edit these two lines for quick manual interaction.
  const txHash = await contract.write.incBy([3n]);
  const result = await contract.read.x();

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("network =", publicNetwork);
  console.log("contract =", contract.address);
  console.log("txHash =", txHash);
  console.log("result =", result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
