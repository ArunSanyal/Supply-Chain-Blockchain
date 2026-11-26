import React, { useState, useEffect, useCallback } from 'react'
import { QRCodeCanvas } from 'qrcode.react';
import useSupplyChain, { fetchBatteries, fetchParticipants, getErrorMessage } from "./useSupplyChain"
import { AccountHeader, StatusScreen, BatteryTable } from "./Layout"

// Each handler appears once the battery has reached `minStage`
const HANDLERS = [
    { minStage: 1, role: "rms", idField: "RMSid", title: "Raw Materials Supplied by", idLabel: "Supplier ID" },
    { minStage: 2, role: "man", idField: "MANid", title: "Manufactured by", idLabel: "Manufacturer ID" },
    { minStage: 3, role: "dis", idField: "DISid", title: "Distributed by", idLabel: "Distributor ID" },
    { minStage: 4, role: "ret", idField: "RETid", title: "Retailed by", idLabel: "Retailer ID" },
];
const SOLD_STAGE = 5;

function Track() {
    const { account, contract, loading, error } = useSupplyChain();
    const [batteries, setBatteries] = useState([]);
    const [participants, setParticipants] = useState({ rms: {}, man: {}, dis: {}, ret: {} });
    const [ID, setID] = useState("");
    const [selected, setSelected] = useState(null);

    const refresh = useCallback(async () => {
        if (!contract) return;
        const [b, p] = await Promise.all([fetchBatteries(contract), fetchParticipants(contract)]);
        setBatteries(b);
        setParticipants(p);
    }, [contract]);

    useEffect(() => {
        refresh().catch((err) => alert(getErrorMessage(err)));
    }, [refresh]);

    if (loading || error) {
        return <StatusScreen loading={loading} error={error} />;
    }

    const handlerSubmit = (event) => {
        event.preventDefault();
        const battery = batteries.find((b) => String(b.id) === ID.trim());
        if (!battery) {
            alert("Invalid Battery ID!!!");
            return;
        }
        setSelected(battery);
    }

    if (selected) {
        const stage = Number(selected.stage);
        const history = HANDLERS
            .filter((h) => stage >= h.minStage)
            .map((h) => ({ ...h, participant: participants[h.role][selected[h.idField]] || {} }));

        const batteryData = {
            id: selected.id,
            name: selected.name,
            description: selected.description,
            currentStage: selected.stageText,
            history: history.map((h) => ({ step: h.title, id: h.participant.id, name: h.participant.name, place: h.participant.place })),
        };

        return (
            <div className="container-xl track-container">
                <AccountHeader account={account} />
                <div className="row">
                    <article className="col-md-8">
                        <h3><b><u>Battery:</u></b></h3>
                        <span><b>Battery ID: </b>{selected.id}</span>
                        <br />
                        <span><b>Name:</b> {selected.name}</span>
                        <br />
                        <span><b>Description: </b>{selected.description}</span>
                        <br />
                        <span><b>Current stage: </b>{selected.stageText}</span>
                    </article>
                    <div className="col-md-4 qr-code-container">
                        <h4>QR Code:</h4>
                        <QRCodeCanvas value={JSON.stringify(batteryData)} size={160} />
                    </div>
                </div>
                <hr />
                <br />
                {history.length === 0 ? (
                    <h5>Battery Not Yet Processed...</h5>
                ) : (
                    <section className="row track-history">
                        {history.map((h, i) => (
                            <React.Fragment key={h.role}>
                                {i > 0 && <span className="track-arrow">&#10132;</span>}
                                <article className="col-md-2">
                                    <h5><u>{h.title}:</u></h5>
                                    <p><b>{h.idLabel}: </b>{h.participant.id}</p>
                                    <p><b>Name:</b> {h.participant.name}</p>
                                    <p><b>Place: </b>{h.participant.place}</p>
                                </article>
                            </React.Fragment>
                        ))}
                        {stage === SOLD_STAGE && (
                            <>
                                <span className="track-arrow">&#10132;</span>
                                <article className="col-md-2">
                                    <h5><u>Sold</u></h5>
                                </article>
                            </>
                        )}
                    </section>
                )}
                <button onClick={() => setSelected(null)} className="btn btn-outline-success btn-sm">Track Another Item</button>
            </div>
        )
    }

    return (
        <div className="container-xl track-container">
            <AccountHeader account={account} />
            <BatteryTable batteries={batteries} />
            <h5>Enter Battery ID to Track it</h5>

            <form onSubmit={handlerSubmit}>
                <input className="form-control-sm" type="number" min="1" value={ID} onChange={(e) => setID(e.target.value)} placeholder="Enter Battery ID" required />
                <button className="btn btn-outline-success btn-sm">Track</button>
            </form>
        </div>
    )
}

export default Track
