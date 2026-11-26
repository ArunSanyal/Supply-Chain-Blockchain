const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const Role = { RawMaterialSupplier: 0, Manufacturer: 1, Distributor: 2, Retailer: 3 };
const Stage = { Ordered: 0, RawMaterialSupply: 1, Manufacture: 2, Distribution: 3, Retail: 4, Sold: 5 };

describe("SupplyChain", () => {
    async function deployFixture() {
        const [owner, rms, man, dis, ret, otherRet, stranger] = await ethers.getSigners();
        const sc = await ethers.deployContract("SupplyChain", owner);
        return { sc, owner, rms, man, dis, ret, otherRet, stranger };
    }

    async function registeredFixture() {
        const f = await deployFixture();
        const { sc, rms, man, dis, ret } = f;
        await sc.addParticipant(Role.RawMaterialSupplier, rms.address, "Lithium Co", "Chile");
        await sc.addParticipant(Role.Manufacturer, man.address, "CellWorks", "Shenzhen");
        await sc.addParticipant(Role.Distributor, dis.address, "FastShip", "Rotterdam");
        await sc.addParticipant(Role.Retailer, ret.address, "PowerMart", "Mumbai");
        return f;
    }

    async function orderedFixture() {
        const f = await registeredFixture();
        await f.sc.addBattery("LFP-100", "100Ah LiFePO4 cell");
        return f;
    }

    const advanceToRetail = async ({ sc, rms, man, dis, ret }, id = 1) => {
        await sc.connect(rms).supplyRawMaterials(id, "", "");
        await sc.connect(man).manufacture(id, "", "");
        await sc.connect(dis).distribute(id, "", "");
        await sc.connect(ret).retail(id, "", "");
    };

    describe("roles", () => {
        it("sets the deployer as owner", async () => {
            const { sc, owner } = await loadFixture(deployFixture);
            expect(await sc.owner()).to.equal(owner.address);
        });

        it("lets the owner register participants and emits an event", async () => {
            const { sc, rms } = await loadFixture(deployFixture);
            await expect(sc.addParticipant(Role.RawMaterialSupplier, rms.address, "Lithium Co", "Chile"))
                .to.emit(sc, "ParticipantAdded")
                .withArgs(Role.RawMaterialSupplier, 1, rms.address, "Lithium Co");
            expect(await sc.participantCount(Role.RawMaterialSupplier)).to.equal(1);
            expect(await sc.participantIdOf(Role.RawMaterialSupplier, rms.address)).to.equal(1);
            const p = await sc.participants(Role.RawMaterialSupplier, 1);
            expect(p.addr).to.equal(rms.address);
            expect(p.name).to.equal("Lithium Co");
            expect(p.active).to.equal(true);
        });

        it("rejects registration from non-owners", async () => {
            const { sc, ret, stranger } = await loadFixture(deployFixture);
            await expect(sc.connect(stranger).addParticipant(Role.Retailer, ret.address, "PowerMart", "Mumbai"))
                .to.be.revertedWithCustomError(sc, "OwnableUnauthorizedAccount")
                .withArgs(stranger.address);
        });

        it("rejects registering the same address twice for a role", async () => {
            const { sc, ret } = await loadFixture(deployFixture);
            await sc.addParticipant(Role.Retailer, ret.address, "PowerMart", "Mumbai");
            await expect(sc.addParticipant(Role.Retailer, ret.address, "PowerMart 2", "Delhi"))
                .to.be.revertedWithCustomError(sc, "AlreadyRegistered")
                .withArgs(Role.Retailer, ret.address);
        });

        it("allows one address to hold several different roles", async () => {
            const { sc, owner } = await loadFixture(deployFixture);
            await sc.addParticipant(Role.RawMaterialSupplier, owner.address, "Self", "Here");
            await sc.addParticipant(Role.Manufacturer, owner.address, "Self", "Here");
            expect(await sc.participantIdOf(Role.RawMaterialSupplier, owner.address)).to.equal(1);
            expect(await sc.participantIdOf(Role.Manufacturer, owner.address)).to.equal(1);
        });

        it("rejects the zero address and empty names", async () => {
            const { sc, rms } = await loadFixture(deployFixture);
            await expect(sc.addParticipant(Role.RawMaterialSupplier, ethers.ZeroAddress, "X", "Y"))
                .to.be.revertedWithCustomError(sc, "InvalidAddress");
            await expect(sc.addParticipant(Role.RawMaterialSupplier, rms.address, "", "Y"))
                .to.be.revertedWithCustomError(sc, "EmptyName");
        });
    });

    describe("updating and deactivating participants", () => {
        it("lets the owner update a participant's name and place", async () => {
            const { sc, man } = await loadFixture(registeredFixture);
            await expect(sc.updateParticipant(Role.Manufacturer, 1, "CellWorks 2", "Taipei"))
                .to.emit(sc, "ParticipantUpdated")
                .withArgs(Role.Manufacturer, 1, "CellWorks 2", "Taipei");
            const p = await sc.participants(Role.Manufacturer, 1);
            expect(p.name).to.equal("CellWorks 2");
            expect(p.place).to.equal("Taipei");
            expect(p.addr).to.equal(man.address);
        });

        it("rejects updates from non-owners, to unknown ids, or with an empty name", async () => {
            const { sc, stranger } = await loadFixture(registeredFixture);
            await expect(sc.connect(stranger).updateParticipant(Role.Manufacturer, 1, "X", "Y"))
                .to.be.revertedWithCustomError(sc, "OwnableUnauthorizedAccount");
            await expect(sc.updateParticipant(Role.Manufacturer, 2, "X", "Y"))
                .to.be.revertedWithCustomError(sc, "InvalidParticipant")
                .withArgs(Role.Manufacturer, 2);
            await expect(sc.updateParticipant(Role.Manufacturer, 1, "", "Y"))
                .to.be.revertedWithCustomError(sc, "EmptyName");
        });

        it("deactivates without deleting the record", async () => {
            const { sc, man } = await loadFixture(registeredFixture);
            await expect(sc.deactivateParticipant(Role.Manufacturer, 1))
                .to.emit(sc, "ParticipantDeactivated")
                .withArgs(Role.Manufacturer, 1);
            const p = await sc.participants(Role.Manufacturer, 1);
            expect(p.active).to.equal(false);
            expect(p.name).to.equal("CellWorks");
            expect(await sc.participantIdOf(Role.Manufacturer, man.address)).to.equal(1);
            expect(await sc.activeParticipantCount(Role.Manufacturer)).to.equal(0);
        });

        it("stops deactivated participants from acting", async () => {
            const { sc, rms, man } = await loadFixture(orderedFixture);
            await sc.connect(rms).supplyRawMaterials(1, "", "");
            await sc.deactivateParticipant(Role.Manufacturer, 1);
            await expect(sc.connect(man).manufacture(1, "", ""))
                .to.be.revertedWithCustomError(sc, "ParticipantInactive")
                .withArgs(Role.Manufacturer, 1);
        });

        it("keeps battery history pointing at a deactivated participant", async () => {
            const { sc, rms } = await loadFixture(orderedFixture);
            await sc.connect(rms).supplyRawMaterials(1, "", "");
            await sc.deactivateParticipant(Role.RawMaterialSupplier, 1);
            expect((await sc.batteries(1)).supplierId).to.equal(1);
            expect((await sc.participants(Role.RawMaterialSupplier, 1)).name).to.equal("Lithium Co");
        });

        it("rejects deactivation from non-owners and of unknown ids", async () => {
            const { sc, stranger } = await loadFixture(registeredFixture);
            await expect(sc.connect(stranger).deactivateParticipant(Role.Retailer, 1))
                .to.be.revertedWithCustomError(sc, "OwnableUnauthorizedAccount")
                .withArgs(stranger.address);
            await expect(sc.deactivateParticipant(Role.Retailer, 0))
                .to.be.revertedWithCustomError(sc, "InvalidParticipant")
                .withArgs(Role.Retailer, 0);
        });

        it("rejects deactivating twice and requires an active participant per role to order", async () => {
            const { sc } = await loadFixture(registeredFixture);
            await sc.deactivateParticipant(Role.Retailer, 1);
            await expect(sc.deactivateParticipant(Role.Retailer, 1))
                .to.be.revertedWithCustomError(sc, "ParticipantInactive")
                .withArgs(Role.Retailer, 1);
            await expect(sc.addBattery("B1", "desc"))
                .to.be.revertedWithCustomError(sc, "MissingActiveParticipant")
                .withArgs(Role.Retailer);
        });

        it("rejects re-registering a deactivated address for the same role", async () => {
            const { sc, ret } = await loadFixture(registeredFixture);
            await sc.deactivateParticipant(Role.Retailer, 1);
            await expect(sc.addParticipant(Role.Retailer, ret.address, "PowerMart", "Mumbai"))
                .to.be.revertedWithCustomError(sc, "AlreadyRegistered")
                .withArgs(Role.Retailer, ret.address);
        });

        it("lets the owner reactivate a participant and emits an event", async () => {
            const { sc } = await loadFixture(registeredFixture);
            await sc.deactivateParticipant(Role.Retailer, 1);
            await expect(sc.reactivateParticipant(Role.Retailer, 1))
                .to.emit(sc, "ParticipantReactivated")
                .withArgs(Role.Retailer, 1);
            expect((await sc.participants(Role.Retailer, 1)).active).to.equal(true);
            expect(await sc.activeParticipantCount(Role.Retailer)).to.equal(1);
        });

        it("rejects reactivation from non-owners, of unknown ids, or of active participants", async () => {
            const { sc, stranger } = await loadFixture(registeredFixture);
            await sc.deactivateParticipant(Role.Retailer, 1);
            await expect(sc.connect(stranger).reactivateParticipant(Role.Retailer, 1))
                .to.be.revertedWithCustomError(sc, "OwnableUnauthorizedAccount")
                .withArgs(stranger.address);
            await expect(sc.reactivateParticipant(Role.Retailer, 2))
                .to.be.revertedWithCustomError(sc, "InvalidParticipant")
                .withArgs(Role.Retailer, 2);
            await expect(sc.reactivateParticipant(Role.Manufacturer, 1))
                .to.be.revertedWithCustomError(sc, "ParticipantAlreadyActive")
                .withArgs(Role.Manufacturer, 1);
        });

        it("lets a battery held by a deactivated retailer be sold after reactivation", async () => {
            const f = await loadFixture(orderedFixture);
            const { sc, ret, otherRet } = f;
            await advanceToRetail(f);
            await sc.addParticipant(Role.Retailer, otherRet.address, "OtherMart", "Delhi");
            await sc.deactivateParticipant(Role.Retailer, 1);

            // While deactivated, neither the holding retailer nor another retailer can sell it
            await expect(sc.connect(ret).markSold(1, "", ""))
                .to.be.revertedWithCustomError(sc, "ParticipantInactive")
                .withArgs(Role.Retailer, 1);
            await expect(sc.connect(otherRet).markSold(1, "", ""))
                .to.be.revertedWithCustomError(sc, "NotBatteryRetailer")
                .withArgs(1);

            await sc.reactivateParticipant(Role.Retailer, 1);
            await expect(sc.connect(ret).markSold(1, "", ""))
                .to.emit(sc, "StageChanged");
            expect((await sc.batteries(1)).stage).to.equal(Stage.Sold);
        });
    });

    describe("batteries", () => {
        it("requires every role to be registered before ordering", async () => {
            const { sc } = await loadFixture(deployFixture);
            await expect(sc.addBattery("B1", "desc"))
                .to.be.revertedWithCustomError(sc, "MissingActiveParticipant")
                .withArgs(Role.RawMaterialSupplier);
        });

        it("only lets the owner order batteries", async () => {
            const { sc, stranger } = await loadFixture(registeredFixture);
            await expect(sc.connect(stranger).addBattery("B1", "desc"))
                .to.be.revertedWithCustomError(sc, "OwnableUnauthorizedAccount")
                .withArgs(stranger.address);
        });

        it("rejects ordering a battery with an empty name", async () => {
            const { sc } = await loadFixture(registeredFixture);
            await expect(sc.addBattery("", "desc")).to.be.revertedWithCustomError(sc, "EmptyName");
        });

        it("reverts stageName for unknown IDs", async () => {
            const { sc } = await loadFixture(deployFixture);
            await expect(sc.stageName(1)).to.be.revertedWithCustomError(sc, "InvalidBattery").withArgs(1);
        });
    });

    describe("full lifecycle", () => {
        it("moves a battery through every stage and records who handled it", async () => {
            const { sc, rms, man, dis, ret } = await loadFixture(orderedFixture);
            expect(await sc.stageName(1)).to.equal("Battery Ordered");

            await sc.connect(rms).supplyRawMaterials(1, "", "");
            expect(await sc.stageName(1)).to.equal("Raw Material Supply Stage");

            await sc.connect(man).manufacture(1, "", "");
            expect(await sc.stageName(1)).to.equal("Manufacturing Stage");

            await sc.connect(dis).distribute(1, "", "");
            expect(await sc.stageName(1)).to.equal("Distribution Stage");

            await sc.connect(ret).retail(1, "", "");
            expect(await sc.stageName(1)).to.equal("Retail Stage");

            await sc.connect(ret).markSold(1, "", "");
            expect(await sc.stageName(1)).to.equal("Battery Sold");

            const b = await sc.batteries(1);
            expect(b.supplierId).to.equal(1);
            expect(b.manufacturerId).to.equal(1);
            expect(b.distributorId).to.equal(1);
            expect(b.retailerId).to.equal(1);
            expect(b.stage).to.equal(Stage.Sold);
        });

        it("blocks callers without the right role", async () => {
            const { sc, man } = await loadFixture(orderedFixture);
            await expect(sc.connect(man).supplyRawMaterials(1, "", ""))
                .to.be.revertedWithCustomError(sc, "NotRegistered")
                .withArgs(Role.RawMaterialSupplier);
        });

        it("blocks skipping stages", async () => {
            const { sc, man } = await loadFixture(orderedFixture);
            await expect(sc.connect(man).manufacture(1, "", ""))
                .to.be.revertedWithCustomError(sc, "WrongStage")
                .withArgs(Stage.RawMaterialSupply, Stage.Ordered);
        });

        it("blocks repeating a stage", async () => {
            const { sc, rms } = await loadFixture(orderedFixture);
            await sc.connect(rms).supplyRawMaterials(1, "", "");
            await expect(sc.connect(rms).supplyRawMaterials(1, "", ""))
                .to.be.revertedWithCustomError(sc, "WrongStage")
                .withArgs(Stage.Ordered, Stage.RawMaterialSupply);
        });

        it("rejects invalid battery IDs", async () => {
            const { sc, rms } = await loadFixture(orderedFixture);
            await expect(sc.connect(rms).supplyRawMaterials(0, "", ""))
                .to.be.revertedWithCustomError(sc, "InvalidBattery").withArgs(0);
            await expect(sc.connect(rms).supplyRawMaterials(2, "", ""))
                .to.be.revertedWithCustomError(sc, "InvalidBattery").withArgs(2);
        });

        it("only lets the retailer holding the battery mark it sold", async () => {
            const f = await loadFixture(orderedFixture);
            await f.sc.addParticipant(Role.Retailer, f.otherRet.address, "OtherMart", "Pune");
            await advanceToRetail(f);
            await expect(f.sc.connect(f.otherRet).markSold(1, "", ""))
                .to.be.revertedWithCustomError(f.sc, "NotBatteryRetailer")
                .withArgs(1);
        });
    });

    describe("StageChanged events", () => {
        it("emits Ordered with participant id 0 when a battery is added", async () => {
            const { sc, owner } = await loadFixture(registeredFixture);
            const tx = sc.addBattery("LFP-100", "cell");
            await expect(tx).to.emit(sc, "BatteryAdded").withArgs(1, "LFP-100");
            const timestamp = await time.latest();
            await expect(tx)
                .to.emit(sc, "StageChanged")
                .withArgs(1, Stage.Ordered, 0, owner.address, timestamp, "", "");
        });

        it("carries the participant, timestamp, location and note", async () => {
            const { sc, rms } = await loadFixture(orderedFixture);
            const tx = sc.connect(rms).supplyRawMaterials(1, "Atacama mine", "Batch L-42");
            await expect(tx).to.not.be.reverted;
            const timestamp = await time.latest();
            await expect(tx)
                .to.emit(sc, "StageChanged")
                .withArgs(1, Stage.RawMaterialSupply, 1, rms.address, timestamp, "Atacama mine", "Batch L-42");
        });

        it("emits one StageChanged per stage over the full lifecycle", async () => {
            const f = await loadFixture(orderedFixture);
            await advanceToRetail(f);
            await f.sc.connect(f.ret).markSold(1, "Mumbai store", "");
            const events = await f.sc.queryFilter(f.sc.filters.StageChanged(1));
            expect(events.map((e) => Number(e.args.stage))).to.deep.equal([0, 1, 2, 3, 4, 5]);
        });
    });

    describe("pausing", () => {
        it("only lets the owner pause and unpause", async () => {
            const { sc, stranger } = await loadFixture(orderedFixture);
            await expect(sc.connect(stranger).pause())
                .to.be.revertedWithCustomError(sc, "OwnableUnauthorizedAccount").withArgs(stranger.address);
            await sc.pause();
            expect(await sc.paused()).to.equal(true);
            await expect(sc.connect(stranger).unpause())
                .to.be.revertedWithCustomError(sc, "OwnableUnauthorizedAccount").withArgs(stranger.address);
            await sc.unpause();
            expect(await sc.paused()).to.equal(false);
        });

        it("blocks ordering and every stage function while paused", async () => {
            const f = await loadFixture(orderedFixture);
            const { sc, rms, ret } = f;
            await sc.pause();
            await expect(sc.addBattery("B2", "d")).to.be.revertedWithCustomError(sc, "EnforcedPause");
            await expect(sc.connect(rms).supplyRawMaterials(1, "", "")).to.be.revertedWithCustomError(sc, "EnforcedPause");
            await sc.unpause();
            await advanceToRetail(f);
            await sc.pause();
            await expect(sc.connect(ret).markSold(1, "", "")).to.be.revertedWithCustomError(sc, "EnforcedPause");
        });

        it("still allows participant admin while paused", async () => {
            const { sc } = await loadFixture(orderedFixture);
            await sc.pause();
            await sc.deactivateParticipant(Role.Manufacturer, 1);
            expect((await sc.participants(Role.Manufacturer, 1)).active).to.equal(false);
        });
    });

    describe("ownership transfer (two-step)", () => {
        it("only changes owner after the new owner accepts", async () => {
            const { sc, owner, stranger } = await loadFixture(deployFixture);
            await sc.transferOwnership(stranger.address);
            expect(await sc.owner()).to.equal(owner.address);
            expect(await sc.pendingOwner()).to.equal(stranger.address);
            await sc.connect(stranger).acceptOwnership();
            expect(await sc.owner()).to.equal(stranger.address);
            await expect(sc.pause())
                .to.be.revertedWithCustomError(sc, "OwnableUnauthorizedAccount").withArgs(owner.address);
        });

        it("rejects acceptance from anyone but the pending owner", async () => {
            const { sc, rms, stranger } = await loadFixture(deployFixture);
            await sc.transferOwnership(stranger.address);
            await expect(sc.connect(rms).acceptOwnership())
                .to.be.revertedWithCustomError(sc, "OwnableUnauthorizedAccount").withArgs(rms.address);
        });
    });
});
