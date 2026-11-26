// Copies the SupplyChain ABI into the frontend. Only the ABI is exported, not the
// full build artifact (which contains bytecode, source and local file paths).
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const CLIENT_CONTRACTS_DIR = path.join(__dirname, "..", "client", "src", "contracts");

async function exportAbi() {
  const { abi } = await hre.artifacts.readArtifact("SupplyChain");
  fs.mkdirSync(CLIENT_CONTRACTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(CLIENT_CONTRACTS_DIR, "SupplyChain.abi.json"), JSON.stringify(abi, null, 2) + "\n");
}

module.exports = { exportAbi, CLIENT_CONTRACTS_DIR };

if (require.main === module) {
  exportAbi()
    .then(() => console.log("Wrote client/src/contracts/SupplyChain.abi.json"))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
