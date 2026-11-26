import { useCallback, useState } from 'react';
import { getErrorMessage, sendTx } from "./useSupplyChain";

const shortHash = (hash) => `${hash.slice(0, 10)}...${hash.slice(-6)}`;

// Runs a transaction and tracks its progress as { state, message } for <TxStatus>,
// where state is "pending", "confirmed" or "failed"
function useTransaction() {
    const [status, setStatus] = useState(null);

    const run = useCallback(async (label, method, from) => {
        setStatus({ state: "pending", message: `${label}: confirm it in your wallet...` });
        try {
            const receipt = await sendTx(method, from, (hash) => setStatus({
                state: "pending",
                message: `${label}: sent (${shortHash(hash)}), waiting for it to be mined...`,
            }));
            setStatus({ state: "confirmed", message: `${label}: confirmed in block ${receipt.blockNumber}.` });
            return true;
        } catch (err) {
            setStatus({ state: "failed", message: `${label} failed: ${getErrorMessage(err)}` });
            return false;
        }
    }, []);

    // For errors that don't come from a transaction, such as a failed page load
    const fail = useCallback((message) => setStatus({ state: "failed", message }), []);

    return { status, run, fail, pending: status !== null && status.state === "pending" };
}

export default useTransaction;
