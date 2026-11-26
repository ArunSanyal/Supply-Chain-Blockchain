<h1 align="center">
  <br>
  <a><img src="https://www.mdpi.com/logistics/logistics-03-00005/article_deploy/html/images/logistics-03-00005-g001.png" width="200"></a>
  <br>  
  Supply-Chain-Dapp
  <br>
</h1>

<p align="center">
  
  <a href="https://docs.godechain.com/welcome/">
    <img src="https://s3.coinmarketcap.com/static-gravity/thumbnail/medium/12b1f4d9727b4aab83cd5398bf6e080d.jpg" width="35" height='35'>
  </a>
  <a href="https://soliditylang.org/">
    <img src="https://github.com/rishav4101/eth-supplychain-dapp/blob/main/images/Solidity.svg" width="80">       
  </a>
  <a href="https://reactjs.org/"><img src="https://github.com/rishav4101/eth-supplychain-dapp/blob/main/images/react.png" width="80"></a>
  
  <a href="https://www.trufflesuite.com/">
    <img src="https://github.com/rishav4101/eth-supplychain-dapp/blob/main/images/trufflenew.png" width="50">
  </a>
   &nbsp;&nbsp;&nbsp;
  <a href="https://www.npmjs.com/package/web3">
    <img src="https://github.com/rishav4101/eth-supplychain-dapp/blob/main/images/web3.jpg" width="60">
  </a>
</p>

<h4 align="center">A simple Supply Chain setup with <a href="https://docs.soliditylang.org/en/v0.8.4/" target="_blank">Solidity</a>.</h4>

<p align="center">
  <a >
    <img src="https://img.shields.io/badge/dependencies-up%20to%20date-brightgreen.svg">
       
  </a>
  
</p>

## Demo 
https://www.canva.com/design/DAFb-i9v_cM/-fK0pKTuOkFq5dfCPQxh_w/watch?utm_content=DAFb-i9v_cM&utm_campaign=designshare&utm_medium=link&utm_source=publishsharelink

## Description
Supply chain is always hard to manage and requires a lot of admistrative machinery. However, when managed with smart contracts using blockchain, a lot of the paperwork is reduced.
Also it leads to an increase in the transparency and helps to build an efficient Root of Trust. Supply-chain-dapp is such an implementation of a supply chain management system which uses blockchain to ensure a transparent and secure transfer of product from the manufacturer to the customer via the online e-commerce websites. 
## Architecture
The smart contract is being written with Solidity which is then compiled, migrated and deployed using Truffle.js on the Gode Testnet blockchain network.The frontend uses Web3.js to communicate with the smart contract and Gode Testnet blockchain network and Meta Musk Wallet is connect to Gode Test Network to do Transaction between each component in Supply .
****
![https://raw.githubusercontent.com/faizack619/Supply-Chain-Gode-Blockchain/master/client/public/Blank%20diagram.png](https://raw.githubusercontent.com/faizack619/Supply-Chain-Gode-Blockchain/master/client/public/Blank%20diagram.png)

## Supply Chain Flow


![[https://cdn.vectorstock.com/i/1000x1000/35/51/diagram-of-supply-chain-management-vector-41743551.webp](https://cdn.vectorstock.com/i/1000x1000/35/51/diagram-of-supply-chain-management-vector-41743551.webp)](https://cdn-wordpress-info.futurelearn.com/info/wp-content/uploads/8d54ad89-e86f-4d7c-8208-74455976a4a9-2-768x489.png)



## Smart Contract Working Flow

![https://raw.githubusercontent.com/faizack619/Supply-Chain-Gode-Blockchain/master/client/public/Supply%20Chain%20Design%20(1).png?token=GHSAT0AAAAAAB52SPAT5YHI3AALNPFXL27AY7OU3IQ](https://raw.githubusercontent.com/faizack619/Supply-Chain-Gode-Blockchain/master/client/public/Supply%20Chain%20Design%20(1).png?token=GHSAT0AAAAAAB52SPAT5YHI3AALNPFXL27AY7OU3IQ)

This is a SupplyChain smart contract written in Solidity (0.8.19). It models the roles and stages involved in the supply chain of a **battery**, from raw materials to the final sale.

* **Owner** - the account that deploys the contract. Only the owner can register participants and order batteries.
* **Participants** - Raw Material Suppliers, Manufacturers, Distributors and Retailers, each registered with an address, name and place. An address can hold several roles, but can't be registered twice for the same one.
* **Stages** - `Ordered -> Raw Material Supply -> Manufacturing -> Distribution -> Retail -> Sold`. Each stage can only be performed by a registered participant of the matching role, and only from the previous stage, so steps can't be skipped or repeated. Only the retailer holding a battery can mark it sold.
* **Events** - `ParticipantAdded`, `BatteryAdded` and `StageChanged` are emitted for every change, giving an auditable on-chain history.
* **Errors** - every `require` has a readable revert reason, which the frontend shows to the user.

### Frontend pages

| Route | Page | Who uses it |
|---|---|---|
| `/` | Home | Everyone |
| `/roles` | Register participants | Owner |
| `/addbattery` | Order a new battery | Owner |
| `/supply` | Move a battery to its next stage | Registered participants |
| `/track` | Full history of a battery, with a QR code | Everyone |

##  🔧 Setting up Local Development

### Prerequisites

* **Node.js** (v16+) - https://nodejs.org/
* **Git** - https://git-scm.com/downloads
* **Ganache** - https://trufflesuite.com/ganache/ (GUI, RPC `127.0.0.1:7545`, network id `5777`)
* **MetaMask** browser extension

### 1. Install dependencies

```bash
git clone https://github.com/faizack619/Supply-Chain-Blockchain.git
cd Supply-Chain-Blockchain
npm install            # installs Truffle locally
cd client && npm install && cd ..
```

### 2. Compile, test and deploy the contract

Start Ganache first (it must be running on `127.0.0.1:7545`; change `truffle-config.js` if your workspace uses a different host/port).

```bash
npm run compile        # truffle compile -> writes ABIs to client/src/artifacts
npm test               # runs the contract test suite in test/
npm run migrate        # truffle migrate --reset -> deploys to Ganache
```

> Re-run `npm run migrate` whenever you restart Ganache or change the contract. The frontend reads the deployed address from `client/src/artifacts/SupplyChain.json`.

### 3. Connect MetaMask to Ganache

1. In MetaMask, add a network: RPC URL `http://127.0.0.1:7545`, chain ID `1337`, currency `ETH`.
2. In Ganache, copy the private key of the **first** account (the deployer / owner) and import it into MetaMask.
3. Import a few more Ganache accounts if you want a different account per role. You can also register the owner's own address for every role to try the whole flow with one account.

### 4. Run the DApp

```bash
cd client
npm start
```

The app runs at http://localhost:3000.

### 5. Walk through the flow

1. **Register Roles** - as the owner, register at least one participant for each of the four roles.
2. **Order Batteries** - as the owner, add a battery.
3. **Supply Chain Flow** - switch MetaMask to each participant's account in turn and advance the battery: Supply -> Manufacture -> Distribute -> Retail -> Sold.
4. **Track Batteries** - enter a battery ID to see who handled each stage, plus a QR code of its data.

### License
This project uses an [MIT](https://opensource.org/licenses/MIT) license.
## Documentation to help with Solidity
https://docs.soliditylang.org/en/v0.8.4/
## Documentation to help with React
https://reactjs.org/docs/getting-started.html
## Documentation to help with Truffle
https://www.trufflesuite.com/docs/truffle/reference/configuration
## Documentation to help with Ganache-cli
https://www.trufflesuite.com/docs/ganache/overview
