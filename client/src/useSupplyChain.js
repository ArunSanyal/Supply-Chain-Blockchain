import { useCallback, useEffect, useState } from 'react';
import Web3 from "web3";
// Both files are written by `npm run deploy:local` / `npm run compile` in the project root
import SUPPLY_CHAIN_ABI from "./contracts/SupplyChain.abi.json";
import DEPLOYMENTS from "./contracts/deployments.json";

// `role` matches the contract's Role enum
export const ROLES = [
    { key: "rms", role: 0, label: "Raw Material Supplier" },
    { key: "man", role: 1, label: "Manufacturer" },
    { key: "dis", role: 2, label: "Distributor" },
    { key: "ret", role: 3, label: "Retailer" },
];

// Matches the contract's Stage enum
export const STAGE_NAMES = ["Ordered", "Raw Material Supply", "Manufacturing", "Distribution", "Retail", "Sold"];

// Role (index into ROLES) that moves a battery into each stage; the owner places the order
export const STAGE_ROLES = [null, 0, 1, 2, 3, 3];

// Contract IDs start at 1
const ids = (count) => Array.from({ length: Number(count) }, (_, i) => i + 1);

export const fetchBatteries = async (contract) => {
    const count = await contract.methods.batteryCount().call();
    return Promise.all(ids(count).map(async (id) => {
        const [battery, stageText] = await Promise.all([
            contract.methods.batteries(id).call(),
            contract.methods.stageName(id).call(),
        ]);
        return { ...battery, stageText };
    }));
};

// Reads one battery, or returns null if the ID doesn't exist
export const fetchBattery = async (contract, id) => {
    const count = await contract.methods.batteryCount().call();
    if (id < 1 || id > Number(count)) return null;
    const [battery, stageText] = await Promise.all([
        contract.methods.batteries(id).call(),
        contract.methods.stageName(id).call(),
    ]);
    return { ...battery, stageText };
};

// A battery's stage history, oldest first, from its StageChanged events.
// `participant` is null for the Ordered stage, which the owner performs.
export const fetchHistory = async (contract, batteryId, fromBlock) => {
    const events = await contract.getPastEvents("StageChanged", {
        filter: { batteryId: String(batteryId) },
        fromBlock,
        toBlock: "latest",
    });
    return Promise.all(events.map(async (e) => {
        const { stage, participantId, by, timestamp, location, note } = e.returnValues;
        const role = STAGE_ROLES[Number(stage)];
        const participant = role === null || participantId === "0"
            ? null
            : await contract.methods.participants(role, participantId).call();
        return {
            key: `${e.transactionHash}-${e.logIndex}`,
            stage: Number(stage),
            role,
            participant,
            by,
            timestamp: Number(timestamp),
            location,
            note,
        };
    }));
};

// Returns { rms: {1: participant, ...}, man: {...}, ... } keyed by participant ID
export const fetchParticipants = async (contract) => {
    const entries = await Promise.all(ROLES.map(async ({ key, role }) => {
        const count = await contract.methods.participantCount(role).call();
        const list = await Promise.all(ids(count).map((id) => contract.methods.participants(role, id).call()));
        return [key, Object.fromEntries(list.map((p) => [p.id, p]))];
    }));
    return Object.fromEntries(entries);
};

const abiCoder = new Web3().eth.abi;
const ERROR_STRING_SELECTOR = "0x08c379a0"; // Error(string)

const roleLabel = (role) => (ROLES[Number(role)] || {}).label || "participant";
const stageLabel = (stage) => STAGE_NAMES[Number(stage)] || `stage ${stage}`;

// User-facing text for the contract's custom errors (including OpenZeppelin's)
const CUSTOM_ERROR_TEXT = {
    InvalidBattery: ([id]) => `Battery ID ${id} does not exist.`,
    InvalidParticipant: ([role, id]) => `There is no ${roleLabel(role)} with ID ${id}.`,
    InvalidAddress: () => "The zero address can't be registered.",
    EmptyName: () => "A name is required.",
    AlreadyRegistered: ([role]) => `That address is already registered as a ${roleLabel(role)}.`,
    NotRegistered: ([role]) => `Your account is not registered as a ${roleLabel(role)}.`,
    ParticipantInactive: ([role, id]) => `${roleLabel(role)} ${id} has been deactivated.`,
    ParticipantAlreadyActive: ([role, id]) => `${roleLabel(role)} ${id} is already active.`,
    MissingActiveParticipant: ([role]) => `Register at least one active ${roleLabel(role)} first.`,
    WrongStage: ([expected, actual]) => `The battery must be in the ${stageLabel(expected)} stage, but it is in ${stageLabel(actual)}.`,
    NotBatteryRetailer: () => "Only the retailer holding this battery can mark it sold.",
    OwnableUnauthorizedAccount: () => "Only the contract owner can do this.",
    EnforcedPause: () => "The contract is paused.",
    ExpectedPause: () => "The contract is not paused.",
};

const CUSTOM_ERRORS = Object.fromEntries(
    SUPPLY_CHAIN_ABI
        .filter((item) => item.type === "error")
        .map((item) => [abiCoder.encodeFunctionSignature(item), item])
);

const decodeRevertData = (data) => {
    if (typeof data !== "string" || data.length < 10) return null;
    const selector = data.slice(0, 10);
    try {
        if (selector === ERROR_STRING_SELECTOR) {
            return abiCoder.decodeParameter("string", "0x" + data.slice(10));
        }
        const abiError = CUSTOM_ERRORS[selector];
        if (!abiError) return null;
        const decoded = abiCoder.decodeParameters(abiError.inputs, "0x" + data.slice(10));
        const args = abiError.inputs.map((_, i) => decoded[i]);
        const text = CUSTOM_ERROR_TEXT[abiError.name];
        return text ? text(args) : abiError.name;
    } catch (e) {
        return null;
    }
};

// Pulls the revert reason out of the nested error objects MetaMask/web3 produce
export const getErrorMessage = (err) => {
    if (!err) return "Unknown error";
    if (err.code === 4001) return "Request rejected in your wallet.";
    const nested = err.data && typeof err.data === "object" ? err.data : {};
    const candidates = [
        typeof err.data === "string" ? err.data : null,
        nested.data,
        nested.result,
        nested.originalError && nested.originalError.data,
    ];
    for (const data of candidates) {
        const decoded = decodeRevertData(data);
        if (decoded) return decoded;
    }
    const raw = nested.message || err.message || String(err);
    const match = raw.match(/(?:execution reverted:|\brevert\b)\s*([^"\\\n]+)/i);
    return match && match[1].trim() ? match[1].trim() : raw;
};

// Simulates the transaction first so a revert surfaces its reason
// instead of a generic wallet error (and no gas is spent on it).
// `onHash` is called once the wallet has sent the transaction.
export const sendTx = async (method, from, onHash) => {
    await method.call({ from });
    const gas = await method.estimateGas({ from });
    const promiEvent = method.send({ from, gas: Math.ceil(gas * 1.2) });
    if (onHash) promiEvent.on("transactionHash", onHash);
    return promiEvent;
};

// Used to read the contract when no wallet is connected. Set it in client/.env;
// it ends up in the browser bundle, so it must not contain a secret.
export const RPC_URL = process.env.REACT_APP_RPC_URL || "http://127.0.0.1:8545";

// deployments.json maps chain ID -> { address, startBlock }
const getDeployment = (chainId) => {
    const entry = DEPLOYMENTS[String(chainId)];
    if (!entry) return null;
    return typeof entry === "string" ? { address: entry, startBlock: 0 } : entry;
};

// Connects to the contract through the wallet if the site is already connected to one,
// otherwise read-only through RPC_URL. `account` is "" in read-only mode.
function useSupplyChain() {
    const [account, setAccount] = useState("");
    const [contract, setContract] = useState(null);
    const [startBlock, setStartBlock] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [connectError, setConnectError] = useState("");
    // Bumped to reconnect, e.g. after the wallet connects or disconnects
    const [session, setSession] = useState(0);

    useEffect(() => {
        const { ethereum } = window;
        let cancelled = false;

        const init = async () => {
            try {
                // eth_accounts doesn't prompt; it is empty until the user connects
                const accounts = ethereum ? await ethereum.request({ method: "eth_accounts" }) : [];
                const walletConnected = accounts.length > 0;
                const web3 = new Web3(walletConnected ? ethereum : RPC_URL);
                let chainId;
                try {
                    chainId = await web3.eth.getChainId();
                } catch (err) {
                    if (walletConnected) throw err;
                    throw new Error(
                        `Couldn't reach the read-only RPC at ${RPC_URL}. Start the local chain with ` +
                        "`npm run node`, or set REACT_APP_RPC_URL in client/.env."
                    );
                }
                const deployment = getDeployment(chainId);
                if (!deployment) {
                    throw new Error(
                        `The SupplyChain contract is not deployed to chain ${chainId}. ` +
                        "Run `npm run node` and `npm run deploy:local`, then point MetaMask at that network."
                    );
                }
                if (cancelled) return;
                setAccount(walletConnected ? accounts[0] : "");
                setContract(new web3.eth.Contract(SUPPLY_CHAIN_ABI, deployment.address));
                setStartBlock(deployment.startBlock);
                setError("");
            } catch (err) {
                if (!cancelled) setError(getErrorMessage(err));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        init();

        if (!ethereum || !ethereum.on) return () => { cancelled = true; };

        const onAccountsChanged = () => setSession((n) => n + 1);
        const onChainChanged = () => window.location.reload();
        ethereum.on("accountsChanged", onAccountsChanged);
        ethereum.on("chainChanged", onChainChanged);
        return () => {
            cancelled = true;
            ethereum.removeListener("accountsChanged", onAccountsChanged);
            ethereum.removeListener("chainChanged", onChainChanged);
        };
    }, [session]);

    const connect = useCallback(async () => {
        setConnectError("");
        if (!window.ethereum) {
            setConnectError("No wallet detected. Install MetaMask to send transactions.");
            return;
        }
        try {
            await window.ethereum.request({ method: "eth_requestAccounts" });
            setSession((n) => n + 1);
        } catch (err) {
            setConnectError(getErrorMessage(err));
        }
    }, []);

    return { account, contract, startBlock, loading, error, connect, connectError };
}

export default useSupplyChain;
