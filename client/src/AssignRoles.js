import React, { useState, useEffect, useCallback } from 'react';
import Web3 from "web3";
import useSupplyChain, { ROLES, fetchParticipants, getErrorMessage } from "./useSupplyChain";
import useTransaction from "./useTransaction";
import { AccountHeader, StatusScreen, TxStatus, WalletNotice } from "./Layout";
import './AssignRoles.css'; // Import custom CSS file

const emptyForm = { address: "", name: "", place: "", type: "rms" };

function AssignRoles() {
    const { account, contract, loading, error, connect, connectError } = useSupplyChain();
    const { status, run, fail, pending } = useTransaction();
    const [participants, setParticipants] = useState({ rms: {}, man: {}, dis: {}, ret: {} });
    const [paused, setPaused] = useState(false);
    const [newRole, setNewRole] = useState(emptyForm);
    // When set, the form edits this participant instead of registering a new one
    const [editing, setEditing] = useState(null);

    const refresh = useCallback(async () => {
        if (!contract) return;
        const [p, isPaused] = await Promise.all([fetchParticipants(contract), contract.methods.paused().call()]);
        setParticipants(p);
        setPaused(isPaused);
    }, [contract]);

    useEffect(() => {
        refresh().catch((err) => fail(`Couldn't load participants: ${getErrorMessage(err)}`));
    }, [refresh, fail]);

    if (loading || error) {
        return <StatusScreen loading={loading} error={error} />;
    }

    // Runs an owner transaction and reloads the page data
    const runTx = async (label, method) => {
        const ok = await run(label, method, account);
        if (ok) await refresh();
        return ok;
    };
    const busy = !account || pending;

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setNewRole((prevState) => ({
            ...prevState,
            [name]: value,
        }));
    };

    const handleRoleSubmit = async (event) => {
        event.preventDefault();
        const { address, name, place, type } = newRole;
        const { role } = ROLES.find((r) => r.key === type);
        if (editing) {
            if (await runTx(`Update ${name}`, contract.methods.updateParticipant(role, editing.id, name, place))) cancelEdit();
            return;
        }
        if (!Web3.utils.isAddress(address)) {
            fail("Please enter a valid Ethereum address.");
            return;
        }
        if (await runTx(`Register ${name}`, contract.methods.addParticipant(role, address, name, place))) {
            setNewRole({ ...emptyForm, type });
        }
    };

    const startEdit = (type, p) => {
        setEditing({ type, id: p.id });
        setNewRole({ type, address: p.addr, name: p.name, place: p.place });
    };

    const cancelEdit = () => {
        setEditing(null);
        setNewRole(emptyForm);
    };

    const deactivate = (role, p) => {
        if (window.confirm(`Deactivate ${p.name}? They will no longer be able to act until reactivated, but their history is kept.`)) {
            runTx(`Deactivate ${p.name}`, contract.methods.deactivateParticipant(role, p.id));
        }
    };

    return (
        <div className="assign-roles-container">
            <AccountHeader account={account} connect={connect} connectError={connectError} />
            <WalletNotice account={account} action="register participants or pause the contract" />
            <div className="pause-bar">
                <span>Contract status: <b>{paused ? "Paused" : "Active"}</b></span>
                <button
                    className={`btn btn-sm ${paused ? "btn-outline-success" : "btn-outline-warning"}`}
                    disabled={busy}
                    onClick={() => runTx(paused ? "Unpause" : "Pause", paused ? contract.methods.unpause() : contract.methods.pause())}
                >
                    {paused ? "Unpause" : "Pause"}
                </button>
            </div>
            <TxStatus status={status} />
            <h4>{editing ? `Edit participant #${editing.id}` : "Assign Roles"}</h4>
            <form onSubmit={handleRoleSubmit} className="role-form">
                <fieldset disabled={busy}>
                    <div className="form-group">
                        <label className="field-label" htmlFor="participant-type">Role</label>
                        <select
                            id="participant-type"
                            className="form-control-sm"
                            name="type"
                            onChange={handleInputChange}
                            value={newRole.type}
                            disabled={!!editing}
                            required
                        >
                            {ROLES.map((role) => (
                                <option key={role.key} value={role.key}>{role.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="field-label" htmlFor="participant-address">Ethereum address</label>
                        <input
                            id="participant-address"
                            className="form-control-sm"
                            type="text"
                            name="address"
                            placeholder="0x..."
                            onChange={handleInputChange}
                            value={newRole.address}
                            disabled={!!editing}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="field-label" htmlFor="participant-name">Name</label>
                        <input
                            id="participant-name"
                            className="form-control-sm"
                            type="text"
                            name="name"
                            onChange={handleInputChange}
                            value={newRole.name}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="field-label" htmlFor="participant-place">Based in</label>
                        <input
                            id="participant-place"
                            className="form-control-sm"
                            type="text"
                            name="place"
                            placeholder="City, country"
                            onChange={handleInputChange}
                            value={newRole.place}
                            required
                        />
                    </div>
                    <button className="btn btn-outline-success btn-sm">
                        {pending ? "Saving..." : editing ? "Save" : "Register"}
                    </button>
                    {editing && (
                        <button type="button" className="btn btn-outline-secondary btn-sm ml-2" onClick={cancelEdit}>Cancel</button>
                    )}
                </fieldset>
            </form>

            <h4>Registered Roles</h4>
            {ROLES.map(({ key, role, label }) => (
                <div key={key}>
                    <h5>{label}s:</h5>
                    <table className="table table-sm">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Place</th>
                                <th>Ethereum Address</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.values(participants[key]).length === 0 && (
                                <tr><td colSpan="6">None registered yet.</td></tr>
                            )}
                            {Object.values(participants[key]).map((p) => (
                                <tr key={p.id}>
                                    <td>{p.id}</td>
                                    <td>{p.name}</td>
                                    <td>{p.place}</td>
                                    <td>{p.addr}</td>
                                    <td>{p.active ? "Active" : "Deactivated"}</td>
                                    <td>
                                        <button className="btn btn-link btn-sm" disabled={busy} onClick={() => startEdit(key, p)}>Edit</button>
                                        {p.active ? (
                                            <button className="btn btn-link btn-sm text-danger" disabled={busy} onClick={() => deactivate(role, p)}>Deactivate</button>
                                        ) : (
                                            <button className="btn btn-link btn-sm text-success" disabled={busy} onClick={() => runTx(`Reactivate ${p.name}`, contract.methods.reactivateParticipant(role, p.id))}>Reactivate</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>
    );
}

export default AssignRoles;
