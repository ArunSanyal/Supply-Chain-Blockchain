import React, { useState, useEffect, useCallback } from 'react'
import useSupplyChain, { fetchBatteries, getErrorMessage, sendTx } from "./useSupplyChain"
import { AccountHeader, StatusScreen, BatteryTable } from "./Layout"

function AddBattery() {
    const { account, contract, loading, error } = useSupplyChain();
    const [batteries, setBatteries] = useState([]);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const refresh = useCallback(async () => {
        if (contract) setBatteries(await fetchBatteries(contract));
    }, [contract]);

    useEffect(() => {
        refresh().catch((err) => alert(getErrorMessage(err)));
    }, [refresh]);

    if (loading || error) {
        return <StatusScreen loading={loading} error={error} />;
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        try {
            await sendTx(contract.methods.addBattery(name, description), account);
            setName("");
            setDescription("");
            await refresh();
        } catch (err) {
            alert(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div style={styles.container}>
            <div style={styles.content}>
                <AccountHeader account={account} />
                <h5>Add Battery Order:</h5>
                <form onSubmit={handleSubmit} style={styles.form}>
                    <input className="form-control-sm" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Battery Name" required />
                    <input className="form-control-sm" type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Battery Description" required />
                    <button className="btn btn-outline-success btn-sm" style={styles.submitButton} disabled={submitting}>
                        {submitting ? "Ordering..." : "Order"}
                    </button>
                </form>
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
    },
    submitButton: {
        marginTop: '10px'
    }
}

export default AddBattery
