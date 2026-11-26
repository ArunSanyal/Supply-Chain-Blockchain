import { useEffect, useState } from 'react';
import Web3 from "web3";
import SupplyChainABI from "./artifacts/SupplyChain.json";

export const ROLES = [
    { key: "rms", label: "Raw Material Supplier", counter: "rmsCtr", getter: "RMS", add: "addRMS" },
    { key: "man", label: "Manufacturer", counter: "manCtr", getter: "MAN", add: "addManufacturer" },
    { key: "dis", label: "Distributor", counter: "disCtr", getter: "DIS", add: "addDistributor" },
    { key: "ret", label: "Retailer", counter: "retCtr", getter: "RET", add: "addRetailer" },
];

// Contract IDs start at 1
const ids = (count) => Array.from({ length: Number(count) }, (_, i) => i + 1);

export const fetchBatteries = async (contract) => {
    const count = await contract.methods.batteryCtr().call();
    return Promise.all(ids(count).map(async (id) => {
        const [battery, stageText] = await Promise.all([
            contract.methods.BatteryStock(id).call(),
            contract.methods.showStage(id).call(),
        ]);
        return { ...battery, stageText };
    }));
};

// Returns { rms: {1: participant, ...}, man: {...}, ... } keyed by participant ID
export const fetchParticipants = async (contract) => {
    const entries = await Promise.all(ROLES.map(async (role) => {
        const count = await contract.methods[role.counter]().call();
        const list = await Promise.all(ids(count).map((id) => contract.methods[role.getter](id).call()));
        return [role.key, Object.fromEntries(list.map((p) => [p.id, p]))];
    }));
    return Object.fromEntries(entries);
};

const abiCoder = new Web3().eth.abi;
const ERROR_STRING_SELECTOR = "0x08c379a0"; // Error(string)

// Pulls the revert reason out of the nested error objects MetaMask/web3 produce
export const getErrorMessage = (err) => {
    if (!err) return "Unknown error";
    if (err.code === 4001) return "Transaction rejected in MetaMask.";
    const nested = err.data && typeof err.data === "object" ? err.data : {};
    const revertData = typeof err.data === "string" ? err.data : nested.data;
    if (typeof revertData === "string" && revertData.startsWith(ERROR_STRING_SELECTOR)) {
        try {
            return abiCoder.decodeParameter("string", "0x" + revertData.slice(10));
        } catch (e) {
            // fall back to parsing the message text
        }
    }
    const raw = nested.message || err.message || String(err);
    const match = raw.match(/(?:execution reverted:|\brevert\b)\s*([^"\\\n]+)/i);
    return match && match[1].trim() ? match[1].trim() : raw;
};

// Simulates the transaction first so a revert surfaces its reason
// instead of a generic wallet error (and no gas is spent on it)
export const sendTx = async (method, from) => {
    await method.call({ from });
    const gas = await method.estimateGas({ from });
    return method.send({ from, gas: Math.ceil(gas * 1.2) });
};

function useSupplyChain() {
    const [account, setAccount] = useState("");
    const [contract, setContract] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const { ethereum } = window;
        let cancelled = false;

        const init = async () => {
            try {
                if (!ethereum) {
                    throw new Error("No Ethereum wallet detected. Please install MetaMask.");
                }
                const web3 = new Web3(ethereum);
                const accounts = await ethereum.request({ method: "eth_requestAccounts" });
                const networkId = await web3.eth.net.getId();
                const networkData = SupplyChainABI.networks[networkId];
                if (!networkData) {
                    throw new Error(
                        `The SupplyChain contract is not deployed to network ${networkId}. ` +
                        "Run `truffle migrate --reset` and point MetaMask at that network."
                    );
                }
                if (cancelled) return;
                setAccount(accounts[0]);
                setContract(new web3.eth.Contract(SupplyChainABI.abi, networkData.address));
            } catch (err) {
                if (!cancelled) setError(getErrorMessage(err));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        init();

        if (!ethereum || !ethereum.on) return () => { cancelled = true; };

        const onAccountsChanged = (accounts) => setAccount(accounts[0] || "");
        const onChainChanged = () => window.location.reload();
        ethereum.on("accountsChanged", onAccountsChanged);
        ethereum.on("chainChanged", onChainChanged);
        return () => {
            cancelled = true;
            ethereum.removeListener("accountsChanged", onAccountsChanged);
            ethereum.removeListener("chainChanged", onChainChanged);
        };
    }, []);

    return { account, contract, loading, error };
}

export default useSupplyChain;
