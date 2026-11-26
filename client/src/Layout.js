import React from 'react';
import { useHistory } from "react-router-dom";

// Shows the connected account, or a Connect Wallet button in read-only mode
export function AccountHeader({ account, connect, connectError }) {
    const history = useHistory();
    return (
        <div className="header-container">
            {account ? (
                <span><b>Current Account Address:</b> {account}</span>
            ) : (
                <span>
                    <b>Read-only mode:</b> no wallet connected.{" "}
                    <button onClick={connect} className="btn btn-outline-primary btn-sm">Connect Wallet</button>
                    {connectError && <span className="inline-error"> {connectError}</span>}
                </span>
            )}
            <button onClick={() => history.push('/')} className="btn btn-outline-danger btn-sm home-button">HOME</button>
        </div>
    );
}

// Shown above a form when there is no wallet to send its transaction from
export function WalletNotice({ account, action }) {
    if (account) return null;
    return <p className="wallet-notice">Connect a wallet to {action}.</p>;
}

const TX_STATUS_CLASSES = { pending: "alert-info", confirmed: "alert-success", failed: "alert-danger" };

// Progress of the last transaction from useTransaction. The wrapper is always rendered
// so screen readers announce changes to it.
export function TxStatus({ status }) {
    return (
        <div aria-live="polite">
            {status && (
                <div className={`alert ${TX_STATUS_CLASSES[status.state]} tx-status`}>{status.message}</div>
            )}
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
