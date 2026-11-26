import React, { useState, useEffect, useCallback } from 'react';
import useSupplyChain, { fetchBatteries, getErrorMessage, sendTx } from "./useSupplyChain";
import { AccountHeader, StatusScreen, BatteryTable } from "./Layout";
import './Supply.css'; // Import custom CSS file

const STEPS = [
    { method: "RMSsupply", title: "Step 1: Supply Raw Materials", who: "Raw Material Supplier", action: "Supply" },
    { method: "Manufacturing", title: "Step 2: Manufacture", who: "Manufacturer", action: "Manufacture" },
    { method: "Distribute", title: "Step 3: Distribute", who: "Distributor", action: "Distribute" },
    { method: "Retail", title: "Step 4: Retail", who: "Retailer", action: "Retail" },
    { method: "sold", title: "Step 5: Mark as Sold", who: "Retailer", action: "Sold" },
];

// Each step keeps its own ID so typing in one form can't leak into another
function StepForm({ step, onSubmit }) {
    const [id, setId] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        if (await onSubmit(step.method, id)) setId("");
        setSubmitting(false);
    };

    return (
        <div className="supply-step">
            <h5><b>{step.title}</b> (Only a registered {step.who} can perform this step):</h5>
            <form onSubmit={handleSubmit}>
                <input className="form-control-sm" type="number" min="1" value={id} onChange={(e) => setId(e.target.value)} placeholder="Enter Battery ID" required />
                <button className="btn btn-outline-success btn-sm" disabled={submitting}>
                    {submitting ? "Submitting..." : step.action}
                </button>
            </form>
        </div>
    );
}

function Supply() {
    const { account, contract, loading, error } = useSupplyChain();
    const [batteries, setBatteries] = useState([]);

    const refresh = useCallback(async () => {
        if (contract) setBatteries(await fetchBatteries(contract));
    }, [contract]);

    useEffect(() => {
        refresh().catch((err) => alert(getErrorMessage(err)));
    }, [refresh]);

    if (loading || error) {
        return <StatusScreen loading={loading} error={error} />;
    }

    const runStep = async (method, id) => {
        try {
            await sendTx(contract.methods[method](id), account);
            await refresh();
            return true;
        } catch (err) {
            alert(getErrorMessage(err));
            return false;
        }
    };

    return (
        <div className="supply-container">
            <AccountHeader account={account} />
            <h6><b>Supply Chain Flow:</b></h6>
            <p>Battery Order -&gt; Raw Material Supplier -&gt; Manufacturer -&gt; Distributor -&gt; Retailer -&gt; Consumer</p>
            <BatteryTable batteries={batteries} className="table table-sm table-dark" />
            {STEPS.map((step) => (
                <StepForm key={step.method} step={step} onSubmit={runStep} />
            ))}
        </div>
    );
}

export default Supply;
