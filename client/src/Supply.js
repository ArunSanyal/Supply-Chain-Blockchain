import React, { useState, useEffect, useCallback } from 'react';
import useSupplyChain, { fetchBatteries, getErrorMessage } from "./useSupplyChain";
import useTransaction from "./useTransaction";
import { AccountHeader, StatusScreen, BatteryTable, TxStatus, WalletNotice } from "./Layout";
import './Supply.css'; // Import custom CSS file

const STEPS = [
    { method: "supplyRawMaterials", title: "Step 1: Supply Raw Materials", who: "Raw Material Supplier", action: "Supply" },
    { method: "manufacture", title: "Step 2: Manufacture", who: "Manufacturer", action: "Manufacture" },
    { method: "distribute", title: "Step 3: Distribute", who: "Distributor", action: "Distribute" },
    { method: "retail", title: "Step 4: Retail", who: "Retailer", action: "Retail" },
    { method: "markSold", title: "Step 5: Mark as Sold", who: "Retailer", action: "Sold" },
];

// Each step keeps its own inputs and transaction status so one form can't affect another
function StepForm({ step, account, contract, onDone }) {
    const { status, run, pending } = useTransaction();
    const [id, setId] = useState("");
    const [location, setLocation] = useState("");
    const [note, setNote] = useState("");
    const field = (name) => `${step.method}-${name}`;

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (await run(`${step.action} battery ${id}`, contract.methods[step.method](id, location, note), account)) {
            setId("");
            setLocation("");
            setNote("");
            await onDone();
        }
    };

    return (
        <div className="supply-step">
            <h5><b>{step.title}</b> (Only a registered {step.who} can perform this step):</h5>
            <form onSubmit={handleSubmit}>
                <fieldset className="inline-fields" disabled={!account || pending}>
                    <div>
                        <label className="field-label" htmlFor={field("id")}>Battery ID</label>
                        <input id={field("id")} className="form-control-sm" type="number" min="1" value={id} onChange={(e) => setId(e.target.value)} required />
                    </div>
                    <div>
                        <label className="field-label" htmlFor={field("location")}>Location (optional)</label>
                        <input id={field("location")} className="form-control-sm" type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
                    </div>
                    <div>
                        <label className="field-label" htmlFor={field("note")}>Note (optional)</label>
                        <input id={field("note")} className="form-control-sm" type="text" value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>
                    <button className="btn btn-outline-success btn-sm">
                        {pending ? "Submitting..." : step.action}
                    </button>
                </fieldset>
            </form>
            <TxStatus status={status} />
        </div>
    );
}

function Supply() {
    const { account, contract, loading, error, connect, connectError } = useSupplyChain();
    const [batteries, setBatteries] = useState([]);
    const [loadError, setLoadError] = useState("");

    const refresh = useCallback(async () => {
        if (contract) setBatteries(await fetchBatteries(contract));
    }, [contract]);

    useEffect(() => {
        refresh().catch((err) => setLoadError(`Couldn't load batteries: ${getErrorMessage(err)}`));
    }, [refresh]);

    if (loading || error) {
        return <StatusScreen loading={loading} error={error} />;
    }

    return (
        <div className="supply-container">
            <AccountHeader account={account} connect={connect} connectError={connectError} />
            <h6><b>Supply Chain Flow:</b></h6>
            <p>Battery Order -&gt; Raw Material Supplier -&gt; Manufacturer -&gt; Distributor -&gt; Retailer -&gt; Consumer</p>
            {loadError && <p className="inline-error">{loadError}</p>}
            <BatteryTable batteries={batteries} className="table table-sm table-dark" />
            <WalletNotice account={account} action="move batteries through the supply chain" />
            {STEPS.map((step) => (
                <StepForm key={step.method} step={step} account={account} contract={contract} onDone={refresh} />
            ))}
        </div>
    );
}

export default Supply;
