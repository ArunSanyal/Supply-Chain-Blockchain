import React from 'react';
import { useHistory } from "react-router-dom";

export function AccountHeader({ account }) {
    const history = useHistory();
    return (
        <div className="header-container">
            <span><b>Current Account Address:</b> {account}</span>
            <button onClick={() => history.push('/')} className="btn btn-outline-danger btn-sm home-button">HOME</button>
        </div>
    );
}

// Full-page loading / error screen shown while the wallet and contract are not ready
export function StatusScreen({ loading, error }) {
    const history = useHistory();
    if (loading) {
        return (
            <div className="loader-container">
                <h1 className="wait">Loading...</h1>
            </div>
        );
    }
    return (
        <div className="loader-container">
            <div className="error-box">
                <h4>Unable to connect</h4>
                <p>{error}</p>
                <button onClick={() => history.push('/')} className="btn btn-outline-danger btn-sm">HOME</button>
            </div>
        </div>
    );
}

export function BatteryTable({ batteries, className = "table table-sm table-bordered" }) {
    return (
        <table className={className}>
            <thead>
                <tr>
                    <th scope="col">Battery ID</th>
                    <th scope="col">Name</th>
                    <th scope="col">Description</th>
                    <th scope="col">Current Processing Stage</th>
                </tr>
            </thead>
            <tbody>
                {batteries.length === 0 && (
                    <tr><td colSpan="4">No batteries ordered yet.</td></tr>
                )}
                {batteries.map((b) => (
                    <tr key={b.id}>
                        <td>{b.id}</td>
                        <td>{b.name}</td>
                        <td>{b.description}</td>
                        <td>{b.stageText}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
