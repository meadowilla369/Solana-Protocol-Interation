# Raydium CLMM Interaction Guide

## 1. Code Structure

### `/src`
- **`RaydiumClmm`**  
  A class for interacting with Raydium CLMM in your target market.  
  When you create an instance of `RaydiumClmm`, you can easily generate unsigned instructions for:
  - Opening positions
  - Increasing liquidity
  - Decreasing liquidity
  - Closing positions

- **`get_rand_address.ts`**  
  Provides **name → address** mappings for mints and markets.  
  Useful for quickly finding market details.

- **`interactClmm.ts`**  
  Demonstrates signing and sending transactions using the `RaydiumClmm` class.

---

### `/target`
- **`idl/`** and **`type/`**  
  Important files for interacting with the deployed Raydium program.

---

## 2. How to Run
**Clone the repository**
   ```bash
   git clone <repo_url>
   cd <repo_name>
   npm install
