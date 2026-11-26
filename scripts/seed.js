// Fills a freshly deployed SupplyChain with demo data: one participant per role and six
// batteries, one at each stage, so every page has something to show.
// Run after `npm run deploy:local`: npm run seed
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { CLIENT_CONTRACTS_DIR } = require("./export-abi");

// Matches the contract's Role enum
const Role = { RawMaterialSupplier: 0, Manufacturer: 1, Distributor: 2, Retailer: 3 };

const PARTICIPANTS = [
  { role: Role.RawMaterialSupplier, label: "Raw Material Supplier", name: "Andes Lithium Co", place: "Antofagasta, Chile" },
  { role: Role.Manufacturer, label: "Manufacturer", name: "VoltCell Manufacturing", place: "Pune, India" },
  { role: Role.Distributor, label: "Distributor", name: "Coastal Logistics", place: "Mumbai, India" },
  { role: Role.Retailer, label: "Retailer", name: "PowerMart", place: "Delhi, India" },
];

// Battery n is moved through the first n - 1 of these steps, so battery 1 stays Ordered
// and battery 6 ends up Sold. `by` indexes into PARTICIPANTS.
const STEPS = [
  { method: "supplyRawMaterials", by: 0, location: "Antofagasta, Chile", note: "Lithium carbonate, lot 2041" },
  { method: "manufacture", by: 1, location: "Pune, India", note: "Passed cell capacity test" },
  { method: "distribute", by: 2, location: "Mumbai, India", note: "Shipped by road" },
  { method: "retail", by: 3, location: "Delhi, India", note: "" },
  { method: "markSold", by: 3, location: "Delhi, India", note: "Sold in store" },
];

const BATTERIES = [
  { name: "LFP-100", description: "100 Ah lithium iron phosphate pack" },
  { name: "LFP-200", description: "200 Ah lithium iron phosphate pack" },
  { name: "NMC-50", description: "50 Ah nickel manganese cobalt pack" },
  { name: "NMC-75", description: "75 Ah nickel manganese cobalt pack" },
  { name: "LFP-12V", description: "12 V starter battery" },
  { name: "NMC-PWR", description: "Home storage battery, 10 kWh" },
];

async function main() {
  const { chainId } = await hre.ethers.provider.getNetwork();
  const deployments = JSON.parse(fs.readFileSync(path.join(CLIENT_CONTRACTS_DIR, "deployments.json"), "utf8"));
  const deployment = deployments[chainId.toString()];
  const address = deployment && (deployment.address || deployment);
  if (!address || (await hre.ethers.provider.getCode(address)) === "0x") {
    throw new Error(`No SupplyChain deployed on chain ${chainId}. Run \`npm run deploy:local\` first.`);
  }

  const signers = await hre.ethers.getSigners();
  const owner = signers[0];
  const accounts = signers.slice(1, 1 + PARTICIPANTS.length);
  const supplyChain = await hre.ethers.getContractAt("SupplyChain", address, owner);

  if ((await supplyChain.batteryCount()) > 0n || (await supplyChain.participantCount(Role.RawMaterialSupplier)) > 0n) {
    throw new Error("The contract already has data. Restart `npm run node` and run `npm run deploy:local` to start fresh.");
  }

  for (const [i, p] of PARTICIPANTS.entries()) {
    await (await supplyChain.addParticipant(p.role, accounts[i].address, p.name, p.place)).wait();
  }

  for (const [i, b] of BATTERIES.entries()) {
    await (await supplyChain.addBattery(b.name, b.description)).wait();
    const id = i + 1;
    for (const step of STEPS.slice(0, i)) {
      const tx = await supplyChain.connect(accounts[step.by])[step.method](id, step.location, step.note);
      await tx.wait();
    }
  }

  console.log(`Seeded SupplyChain at ${address} on chain ${chainId}.`);
  console.log(`Owner: Account #0 ${owner.address}`);
  PARTICIPANTS.forEach((p, i) => {
    console.log(`${p.label}: Account #${i + 1} ${accounts[i].address} (${p.name})`);
  });
  for (const [i] of BATTERIES.entries()) {
    console.log(`Battery ${i + 1}: ${await supplyChain.stageName(i + 1)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
