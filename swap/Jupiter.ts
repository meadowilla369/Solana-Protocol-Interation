import { AddressLookupTableAccount, Connection, Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import dotenv from "dotenv"; 
import fs from "fs";
dotenv.config();

const wallet = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync('phantom-mainnet-keypair.json', 'utf8')))
);
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

const getSwapInstrucion = async (userPublicKey: PublicKey, inputMint: string, outputMint: string, amount: number, slippageBps: number) => {
    const quoteResponse = await (
        await fetch(
            `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`
        )
    ).json();

    const instructions = await((
        await fetch('https://lite-api.jup.ag/swap/v1/swap-instructions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                quoteResponse,
                userPublicKey,
                wrapAndUnwrapSol: true,
                includeLookupTableAddresses: true,
            })
        })
    )).json();

    console.log(instructions);

    const {
        tokenLedgerInstruction, // If you are using `useTokenLedger = true`.
        computeBudgetInstructions, // The necessary instructions to setup the compute budget.
        setupInstructions, // Setup missing ATA for the users.
        swapInstruction: swapInstructionPayload, // The actual swap instruction.
        cleanupInstruction, // Unwrap the SOL if `wrapAndUnwrapSol = true`.
        addressLookupTableAddresses, // The lookup table addresses that you can use if you are using versioned transaction.
    } = instructions;

    console.log(instructions);

    const deserializeInstruction = (instruction: any) => {
        return new TransactionInstruction({
        programId: new PublicKey(instruction.programId),
        keys: instruction.accounts.map((key: any) => ({
            pubkey: new PublicKey(key.pubkey),
            isSigner: key.isSigner,
            isWritable: key.isWritable,
        })),
        data: Buffer.from(instruction.data, "base64"),
        });
    };

    const swapInstructions: TransactionInstruction[] = [];

    // if (computeBudgetInstructions && Array.isArray(computeBudgetInstructions)) {
    //     computeBudgetInstructions.forEach((ix: any) => {
    //         swapInstructions.push(deserializeInstruction(ix));
    //     });
    // }

    if (Array.isArray(setupInstructions) && setupInstructions.length > 0) {
        setupInstructions.forEach((ix: any) => {
            swapInstructions.push(deserializeInstruction(ix));
        });
    }

    // if (tokenLedgerInstruction) {
    //     swapInstructions.push(deserializeInstruction(tokenLedgerInstruction));
    // }

    if (swapInstructionPayload) {
        swapInstructions.push(deserializeInstruction(swapInstructionPayload));
    }

    if (cleanupInstruction) {
        swapInstructions.push(deserializeInstruction(cleanupInstruction));
    }

    return {
        swapInstructions,
        addressLookupTableAddresses
    };
}

const main = async () => {

    const inputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
    const outputMint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"; // USDT
    const amount = 0.000001 * 1e9;
    const slippageBps = 50;

    const {swapInstructions: instructions, addressLookupTableAddresses}  = await getSwapInstrucion(wallet.publicKey, inputMint, outputMint, amount, slippageBps);

    const getAddressLookupTableAccounts = async (
        keys: string[]
    ): Promise<AddressLookupTableAccount[]> => {
        const addressLookupTableAccountInfos =
        await connection.getMultipleAccountsInfo(
            keys.map((key) => new PublicKey(key))
        );

        return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
        const addressLookupTableAddress = keys[index];
        if (accountInfo) {
            const addressLookupTableAccount = new AddressLookupTableAccount({
                key: new PublicKey(addressLookupTableAddress),
                state: AddressLookupTableAccount.deserialize(accountInfo.data),
            });
            acc.push(addressLookupTableAccount);
        }
        return acc;
        }, new Array<AddressLookupTableAccount>());
    };

    const addressLookupTableAccounts: AddressLookupTableAccount[] = [];

    addressLookupTableAccounts.push(
        ...(await getAddressLookupTableAccounts(addressLookupTableAddresses))
    );

    const blockhash = (await connection.getLatestBlockhash()).blockhash;
    const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions: instructions,
    }).compileToV0Message(addressLookupTableAccounts);
    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([wallet]);

    const signature = await connection.sendTransaction(transaction);
    console.log("Transaction signature: ", signature);  
}

main();

