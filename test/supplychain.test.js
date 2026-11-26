const SupplyChain = artifacts.require("SupplyChain");

const expectRevert = async (promise, reason) => {
    try {
        await promise;
    } catch (err) {
        assert.include(err.message, reason);
        return;
    }
    assert.fail(`Expected revert with "${reason}"`);
};

contract("SupplyChain", (accounts) => {
    const [owner, rms, man, dis, ret, otherRet, stranger] = accounts;
    let sc;

    const registerAll = async () => {
        await sc.addRMS(rms, "Lithium Co", "Chile", { from: owner });
        await sc.addManufacturer(man, "CellWorks", "Shenzhen", { from: owner });
        await sc.addDistributor(dis, "FastShip", "Rotterdam", { from: owner });
        await sc.addRetailer(ret, "PowerMart", "Mumbai", { from: owner });
    };

    beforeEach(async () => {
        sc = await SupplyChain.new({ from: owner });
    });

    describe("roles", () => {
        it("sets the deployer as owner", async () => {
            assert.equal(await sc.Owner(), owner);
        });

        it("lets the owner register participants and emits an event", async () => {
            const tx = await sc.addRMS(rms, "Lithium Co", "Chile", { from: owner });
            assert.equal(tx.logs[0].event, "ParticipantAdded");
            assert.equal((await sc.rmsCtr()).toNumber(), 1);
            assert.equal((await sc.rmsIdOf(rms)).toNumber(), 1);
            const p = await sc.RMS(1);
            assert.equal(p.addr, rms);
            assert.equal(p.name, "Lithium Co");
        });

        it("rejects registration from non-owners", async () => {
            await expectRevert(
                sc.addRetailer(ret, "PowerMart", "Mumbai", { from: stranger }),
                "Only the owner can perform this action"
            );
        });

        it("rejects registering the same address twice for a role", async () => {
            await sc.addRetailer(ret, "PowerMart", "Mumbai", { from: owner });
            await expectRevert(
                sc.addRetailer(ret, "PowerMart 2", "Delhi", { from: owner }),
                "Address is already a retailer"
            );
        });

        it("allows one address to hold several different roles", async () => {
            await sc.addRMS(owner, "Self", "Here", { from: owner });
            await sc.addManufacturer(owner, "Self", "Here", { from: owner });
            assert.equal((await sc.rmsIdOf(owner)).toNumber(), 1);
            assert.equal((await sc.manIdOf(owner)).toNumber(), 1);
        });

        it("rejects the zero address and empty names", async () => {
            await expectRevert(
                sc.addRMS("0x0000000000000000000000000000000000000000", "X", "Y", { from: owner }),
                "Invalid address"
            );
            await expectRevert(sc.addRMS(rms, "", "Y", { from: owner }), "Name is required");
        });
    });

    describe("batteries", () => {
        it("requires every role to be registered before ordering", async () => {
            await expectRevert(
                sc.addBattery("B1", "desc", { from: owner }),
                "Register at least one participant for every role first"
            );
        });

        it("only lets the owner order batteries", async () => {
            await registerAll();
            await expectRevert(sc.addBattery("B1", "desc", { from: stranger }), "Only the owner");
        });

        it("reverts showStage for unknown IDs", async () => {
            await expectRevert(sc.showStage(1), "Invalid battery ID");
        });
    });

    describe("full lifecycle", () => {
        beforeEach(async () => {
            await registerAll();
            await sc.addBattery("LFP-100", "100Ah LiFePO4 cell", { from: owner });
        });

        it("moves a battery through every stage and records who handled it", async () => {
            assert.equal(await sc.showStage(1), "Battery Ordered");

            const tx = await sc.RMSsupply(1, { from: rms });
            assert.equal(tx.logs[0].event, "StageChanged");
            assert.equal(await sc.showStage(1), "Raw Material Supply Stage");

            await sc.Manufacturing(1, { from: man });
            assert.equal(await sc.showStage(1), "Manufacturing Stage");

            await sc.Distribute(1, { from: dis });
            assert.equal(await sc.showStage(1), "Distribution Stage");

            await sc.Retail(1, { from: ret });
            assert.equal(await sc.showStage(1), "Retail Stage");

            await sc.sold(1, { from: ret });
            assert.equal(await sc.showStage(1), "Battery Sold");

            const b = await sc.BatteryStock(1);
            assert.equal(b.RMSid.toNumber(), 1);
            assert.equal(b.MANid.toNumber(), 1);
            assert.equal(b.DISid.toNumber(), 1);
            assert.equal(b.RETid.toNumber(), 1);
            assert.equal(b.stage.toNumber(), 5);
        });

        it("blocks callers without the right role", async () => {
            await expectRevert(
                sc.RMSsupply(1, { from: man }),
                "Caller is not a registered raw material supplier"
            );
        });

        it("blocks skipping stages", async () => {
            await expectRevert(
                sc.Manufacturing(1, { from: man }),
                "Battery is not in the Raw Material Supply stage"
            );
        });

        it("blocks repeating a stage", async () => {
            await sc.RMSsupply(1, { from: rms });
            await expectRevert(sc.RMSsupply(1, { from: rms }), "Battery is not in the Ordered stage");
        });

        it("rejects invalid battery IDs", async () => {
            await expectRevert(sc.RMSsupply(0, { from: rms }), "Invalid battery ID");
            await expectRevert(sc.RMSsupply(2, { from: rms }), "Invalid battery ID");
        });

        it("only lets the retailer holding the battery mark it sold", async () => {
            await sc.addRetailer(otherRet, "OtherMart", "Pune", { from: owner });
            await sc.RMSsupply(1, { from: rms });
            await sc.Manufacturing(1, { from: man });
            await sc.Distribute(1, { from: dis });
            await sc.Retail(1, { from: ret });
            await expectRevert(
                sc.sold(1, { from: otherRet }),
                "Only the retailer holding this battery can sell it"
            );
        });
    });
});
