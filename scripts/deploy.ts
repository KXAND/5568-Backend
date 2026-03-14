// scripts/deploy.ts
import { network } from "hardhat";

async function main() {
    // Config
    const ContractName = "AliceFaucet";
    const accountIndex = 0;
    const initialSupply = 1_000n * 10n ** 18n;
    const dripAmount = 100n * 10n ** 18n;
    const cooldown = 1n;

    // init
    const { viem } = await network.connect({ network: "localhost" });
    const account = (await viem.getWalletClients())[accountIndex];

    // Deploy AliceFaucet
    const faucet = await viem.deployContract(
        ContractName,
        [initialSupply, dripAmount, cooldown],
        { client: { wallet: account } }
    );

    console.log("AliceFaucet:", faucet.address);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
