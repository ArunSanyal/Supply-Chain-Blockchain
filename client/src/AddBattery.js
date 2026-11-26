import React, { useState, useEffect, useCallback } from 'react'
import useSupplyChain, { fetchBatteries, getErrorMessage } from "./useSupplyChain"
import useTransaction from "./useTransaction"
import { AccountHeader, StatusScreen, BatteryTable, TxStatus, WalletNotice } from "./Layout"

function AddBattery() {
    const { account, contract, loading, error, connect, connectError } = useSupplyChain();
    const { status, run, fail, pending } = useTransaction();
    const [batteries, setBatteries] = useState([]);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const refresh = useCallback(async () => {
        if (contract) setBatteries(await fetchBatteries(contract));
    }, [contract]);

    useEffect(() => {
        refresh().catch((err) => fail(`Couldn't load batteries: ${getErrorMessage(err)}`));
    }, [refresh, fail]);

    if (loading || error) {
        return <StatusScreen loading={loading} error={error} />;
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (await run(`Order "${name}"`, contract.methods.addBattery(name, description), account)) {
            setName("");
            setDescription("");
            await refresh();
        }
    }

    return (
        <div style={styles.container}>
            <div style={styles.content}>
                <AccountHeader account={account} connect={connect} connectError={connectError} />
                <h5>Add Battery Order:</h5>
                <WalletNotice account={account} action="order batteries" />
                <form onSubmit={handleSubmit} style={styles.form}>
                    <fieldset className="inline-fields" disabled={!account || pending}>
                        <div>
                            <label className="field-label" htmlFor="battery-name">Battery name</label>
                            <input id="battery-name" className="form-control-sm" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. LFP-100" required />
                        </div>
                        <div>
                            <label className="field-label" htmlFor="battery-description">Description</label>
                            <input id="battery-description" className="form-control-sm" type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. 100 Ah cell pack" required />
                        </div>
                        <button className="btn btn-outline-success btn-sm">
                            {pending ? "Ordering..." : "Order"}
                        </button>
                    </fieldset>
                </form>
                <TxStatus status={status} />
                <p className="text-muted small">Only the contract owner can order, and every role must have at least one registered participant.</p>
                <h5>Ordered Batteries:</h5>
                <BatteryTable batteries={batteries} className="table table-bordered" />
            </div>
        </div>
    )
}

const styles = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f4c3 30%, #c5e1a5 90%)', // Background gradient
        padding: '20px'
    },
    content: {
        backgroundColor: '#ffffffcc', // Slightly transparent white background
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0px 0px 15px rgba(0, 0, 0, 0.2)',
        maxWidth: '700px',
        width: '100%',
        textAlign: 'center'
    },
    form: {
        marginBottom: '10px'
    }
}

export default AddBattery
