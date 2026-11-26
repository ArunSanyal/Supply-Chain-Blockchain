// Deploys SupplyChain and records its address and deployment block in
// client/src/contracts/deployments.json, keyed by chain ID, so the frontend can find it on
// whichever network MetaMask is on and only search for events from that block onwards.
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { exportAbi, CLIENT_CONTRACTS_DIR } = require("./export-abi");

const DEPLOYMENTS_FILE = path.join(CLIENT_CONTRACTS_DIR, "deployments.json");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const supplyChain = await hre.ethers.deployContract("SupplyChain");
  await supplyChain.waitForDeployment();

  const address = await supplyChain.getAddress();
  const receipt = await supplyChain.deploymentTransaction().wait();
  const { chainId } = await hre.ethers.provider.getNetwork();

  const deployments = fs.existsSync(DEPLOYMENTS_FILE)
    ? JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, "utf8"))
    : {};
  deployments[chainId.toString()] = { address, startBlock: receipt.blockNumber };
  fs.mkdirSync(CLIENT_CONTRACTS_DIR, { recursive: true });
  fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(deployments, null, 2) + "\n");
  await exportAbi();

  console.log(`SupplyChain deployed to ${address} on chain ${chainId} (owner ${deployer.address})`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
