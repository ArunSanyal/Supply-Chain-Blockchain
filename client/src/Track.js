import React, { useState, useEffect } from 'react'
import { useHistory, useParams } from "react-router-dom"
import { QRCodeCanvas } from 'qrcode.react';
import useSupplyChain, { ROLES, STAGE_NAMES, fetchBattery, fetchHistory, getErrorMessage } from "./useSupplyChain"
import { AccountHeader, StatusScreen } from "./Layout"

const isBatteryId = (value) => /^[1-9]\d*$/.test(value);

function TrackSearch() {
    const history = useHistory();
    const [ID, setID] = useState("");

    const handlerSubmit = (event) => {
        event.preventDefault();
        history.push(`/track/${ID.trim()}`);
    }

    return (
        <form onSubmit={handlerSubmit}>
            <h5>Enter Battery ID to Track it</h5>
            <div className="inline-fields">
                <div>
                    <label className="field-label" htmlFor="track-id">Battery ID</label>
                    <input id="track-id" className="form-control-sm" type="number" min="1" value={ID} onChange={(e) => setID(e.target.value)} required />
                </div>
                <button className="btn btn-outline-success btn-sm">Track</button>
            </div>
        </form>
    )
}

function HistoryEntry({ entry }) {
    const { participant, role } = entry;
    return (
        <li className="timeline-entry">
            <h5>{STAGE_NAMES[entry.stage]}</h5>
            <p className="timeline-time">{new Date(entry.timestamp * 1000).toLocaleString()}</p>
            <p>
                <b>By: </b>
                {participant
                    ? `${ROLES[role].label} ${participant.id}: ${participant.name}${participant.place ? ` (${participant.place})` : ""}`
                    : "Contract owner"}
                <br />
                <span className="timeline-address">{entry.by}</span>
            </p>
            {entry.location && <p><b>Location: </b>{entry.location}</p>}
            {entry.note && <p><b>Note: </b>{entry.note}</p>}
        </li>
    )
}

function TrackBattery({ id, contract, startBlock }) {
    const history = useHistory();
    const [battery, setBattery] = useState(null);
    const [events, setEvents] = useState([]);
    const [status, setStatus] = useState("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setStatus("loading");
            if (!isBatteryId(id)) {
                setStatus("missing");
                setMessage(`"${id}" is not a valid battery ID.`);
                return;
            }
            try {
                const b = await fetchBattery(contract, Number(id));
                if (cancelled) return;
                if (!b) {
                    setStatus("missing");
                    setMessage(`Battery ID ${id} does not exist.`);
                    return;
                }
                const h = await fetchHistory(contract, id, startBlock);
                if (cancelled) return;
                setBattery(b);
                setEvents(h);
                setStatus("ready");
            } catch (err) {
                if (cancelled) return;
                setStatus("missing");
                setMessage(getErrorMessage(err));
            }
        };
        load();
        return () => { cancelled = true; };
    }, [contract, id, startBlock]);

    const backButton = (
        <button onClick={() => history.push('/track')} className="btn btn-outline-success btn-sm">Track Another Item</button>
    );

    if (status === "loading") return <h5>Loading battery {id}...</h5>;
    if (status === "missing") {
        return (
            <>
                <p className="inline-error">{message}</p>
                {backButton}
            </>
        );
    }

    // The QR code links back to this page, so scanning it shows the live record
    const trackUrl = `${window.location.origin}/track/${battery.id}`;

    return (
        <>
            <div className="row">
                <article className="col-md-8">
                    <h3><b><u>Battery:</u></b></h3>
                    <span><b>Battery ID: </b>{battery.id}</span>
                    <br />
                    <span><b>Name:</b> {battery.name}</span>
                    <br />
                    <span><b>Description: </b>{battery.description}</span>
                    <br />
                    <span><b>Current stage: </b>{battery.stageText}</span>
                </article>
                <div className="col-md-4 qr-code-container">
                    <QRCodeCanvas value={trackUrl} size={160} />
                    <p><a href={trackUrl}>{trackUrl}</a></p>
                </div>
            </div>
            <hr />
            <h4>History</h4>
            <ol className="timeline">
                {events.map((entry) => <HistoryEntry key={entry.key} entry={entry} />)}
            </ol>
            {backButton}
        </>
    )
}

function Track() {
    const { id } = useParams();
    const { account, contract, startBlock, loading, error, connect, connectError, wrongNetwork, switchNetwork } = useSupplyChain();

    if (loading || error) {
        return <StatusScreen loading={loading} error={error} />;
    }

    return (
        <div className="container-xl track-container">
            <AccountHeader account={account} connect={connect} connectError={connectError} wrongNetwork={wrongNetwork} switchNetwork={switchNetwork} />
            {id === undefined
                ? <TrackSearch />
                : <TrackBattery id={id} contract={contract} startBlock={startBlock} />}
        </div>
    )
}

export default Track
