# Solana Protocol Interaction Scripts

This repository contains a suite of scripts designed to interact with various protocols and services on the Solana blockchain. It provides examples for liquidity management on Raydium, lending and borrowing on Kamino, and bridging assets using Circle's CCTP.

## 📁 Repository Structure

* `bridge/`: Contains a script for bridging assets (specifically USDC) from Solana to other EVM chains like Base and Arbitrum using Circle's Cross-Chain Transfer Protocol (CCTP).
* `protocols/Kamino/`: Scripts for interacting with the Kamino lending and borrowing protocol, including functions for depositing, withdrawing, and claiming rewards.
* `protocols/Raydium/`: Scripts for interacting with the Raydium Concentrated Liquidity Market Maker (CLMM).
* `protocols/Wasabi/`: Scripts for interacting with the Wasabi protocol (client, etc.).
* `package.json`: Lists all project dependencies.
* `tsconfig.json`: TypeScript configuration file.

## ✨ Features

* **Raydium CLMM Interaction:** Easily manage concentrated liquidity positions by opening, increasing, decreasing, or closing positions.
* **Kamino Lending:** Deposit and withdraw assets to and from Kamino, and claim farming rewards.
* **CCTP Bridging:** Bridge USDC from the Solana network to EVM-compatible chains like Base and Arbitrum.
* **Modular Design:** Each protocol is contained within its own directory with dedicated interaction scripts and helper functions, making it easy to understand and use.

## 🛠️ Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/meadowilla369/Solana-Protocol-Interation.git](https://github.com/meadowilla369/Solana-Protocol-Interation.git)
   cd Solana-Protocol-Interation
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure your wallet:**
   The scripts assume you have a `phantom-mainnet-keypair.json` file in the root directory. This is your Solana wallet keypair. **Warning: This file contains your private key and should be handled with extreme care.**

4. **Configure environment variables (for CCTP bridging):**
   Create a `.env` file in the root directory with your EVM private key:
   ```
   PRIVATE_KEY="YOUR_EVM_PRIVATE_KEY"
   ```

## 🚀 Usage
### CCTP Bridging

The `bridge/bridgeByCCTP.ts` script demonstrates how to bridge USDC from Solana. It burns the USDC on Solana and then calls the `receiveMessage` function on the destination chain to mint the USDC.
To use the bridging script, you can run:

```bash
npx ts-node bridge/bridgeByCCTP.ts
```

*Note: This script is configured to bridge to the Base network by default. You can modify the `bridgeUSDCFromSolTo` function call at the bottom of the file to change the destination chain and address.*

### Kamino Lending

The `protocols/Kamino/src/interact.ts` script provides examples for depositing, withdrawing, and claiming rewards on Kamino. Uncomment the function call you want to use at the bottom of the file.

### Raydium CLMM

The `protocols/Raydium/src/interactClmm.ts` script demonstrates how to interact with Raydium. You can use it to create, manage, and close positions.

### Wasabi Lending

The `protocols/Wasabi/src/client.ts` script describes how to interact with pool USDC on Solana. You can deposit, redeem, withdraw by changing the calling function.

## 📄 License

This project is licensed under the MIT License.
