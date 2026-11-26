import React, { useState, useEffect, useCallback } from 'react';
import Web3 from "web3";
import useSupplyChain, { ROLES, fetchParticipants, getErrorMessage, sendTx } from "./useSupplyChain";
import { AccountHeader, StatusScreen } from "./Layout";
import './AssignRoles.css'; // Import custom CSS file

const emptyForm = { address: "", name: "", place: "", type: "rms" };

function AssignRoles() {
    const { account, contract, loading, error } = useSupplyChain();
    const [participants, setParticipants] = useState({ rms: {}, man: {}, dis: {}, ret: {} });
    const [newRole, setNewRole] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);

    const refresh = useCallback(async () => {
        if (contract) setParticipants(await fetchParticipants(contract));
    }, [contract]);

    useEffect(() => {
        refresh().catch((err) => alert(getErrorMessage(err)));
    }, [refresh]);

    if (loading || error) {
        return <StatusScreen loading={loading} error={error} />;
    }

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
        if (!Web3.utils.isAddress(address)) {
            alert("Please enter a valid Ethereum address.");
            return;
        }
        const role = ROLES.find((r) => r.key === type);
        setSubmitting(true);
        try {
            await sendTx(contract.methods[role.add](address, name, place), account);
            setNewRole({ ...emptyForm, type });
            await refresh();
        } catch (err) {
            alert(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="assign-roles-container">
            <AccountHeader account={account} />
            <h4>Assign Roles</h4>
            <form onSubmit={handleRoleSubmit} className="role-form">
                <div className="form-group">
                    <select
                        className="form-control-sm"
                        name="type"
                        onChange={handleInputChange}
                        value={newRole.type}
                        required
                    >
                        {ROLES.map((role) => (
                            <option key={role.key} value={role.key}>{role.label}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <input
                        className="form-control-sm"
                        type="text"
                        name="address"
                        placeholder="Ethereum Address"
                        onChange={handleInputChange}
                        value={newRole.address}
                        required
                    />
                </div>
                <div className="form-group">
                    <input
                        className="form-control-sm"
                        type="text"
                        name="name"
                        placeholder="Name"
                        onChange={handleInputChange}
                        value={newRole.name}
                        required
                    />
                </div>
                <div className="form-group">
                    <input
                        className="form-control-sm"
                        type="text"
                        name="place"
                        placeholder="Based In"
                        onChange={handleInputChange}
                        value={newRole.place}
                        required
                    />
                </div>
                <button className="btn btn-outline-success btn-sm" disabled={submitting}>
                    {submitting ? "Registering..." : "Register"}
                </button>
            </form>

            <h4>Registered Roles</h4>
            {ROLES.map((role) => (
                <div key={role.key}>
                    <h5>{role.label}s:</h5>
                    <table className="table table-sm">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Place</th>
                                <th>Ethereum Address</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.values(participants[role.key]).length === 0 && (
                                <tr><td colSpan="4">None registered yet.</td></tr>
                            )}
                            {Object.values(participants[role.key]).map((p) => (
                                <tr key={p.id}>
                                    <td>{p.id}</td>
                                    <td>{p.name}</td>
                                    <td>{p.place}</td>
                                    <td>{p.addr}</td>
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
