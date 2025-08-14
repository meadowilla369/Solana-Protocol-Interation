import tokenMessengerMinterIdl from './target/token_messenger_minter.json';
import messageTransmitterIdl from './target/message_transmitter.json';
import {Program, AnchorProvider} from "@project-serum/anchor";
import {Connection, Keypair, PublicKey, Transaction, TransactionInstruction} from "@solana/web3.js";
import * as anchor from '@coral-xyz/anchor';
import * as fs from 'fs';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { SYSTEM_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/native/system';
import { ethers, keccak256 } from "ethers";
import dotenv from 'dotenv';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

// CONSTANTS
dotenv.config();
const solWallet = anchor.web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('phantom-mainnet-keypair.json', 'utf8'))));
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const provider = new AnchorProvider(connection, new anchor.Wallet(solWallet), {commitment: 'confirmed'});
const program = new Program(tokenMessengerMinterIdl as any, tokenMessengerMinterIdl.metadata.address, provider);
const messageTransmitterProgram = new Program(messageTransmitterIdl as any, messageTransmitterIdl.metadata.address, provider);
const burnTokenMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC
const destChains: Record<string, number> = {
    arbitrum: 3,
    base: 6,
};
const rpcUrl: Record<string, string> = {
    arbitrum: "https://arb1.arbitrum.io/rpc",
    base: "https://mainnet.base.org"
};
const messageTransmitterAddresses: Record<string, string> = {
    arbitrum: "0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca", 
    base: "0xAD09780d193884d503182aD4588450C416D6F9D4"
};
const tokenMinterAddresses: Record<string, string> = {
    arbitrum: "0xE7Ed1fa7f45D05C508232aa32649D89b73b8bA48",
    base: "0xe45B133ddc64bE80252b0e9c75A8E74EF280eEd6"
};

// ACCOUNTS
const [senderAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("sender_authority")],
    program.programId
);
const burnTokenAccount = getAssociatedTokenAddressSync(burnTokenMint, solWallet.publicKey);
const [messageTransmitter] = PublicKey.findProgramAddressSync(
    [Buffer.from('message_transmitter')],
    messageTransmitterProgram.programId
);
const [tokenMessenger] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_messenger')],
    program.programId
);
const getRemoteTokenMessenger = (domain: number) => {
    const [remoteTokenMessenger] = PublicKey.findProgramAddressSync(
        [Buffer.from('remote_token_messenger'), Buffer.from(domain.toString())],
        program.programId
    );
    return remoteTokenMessenger;
};
const [tokenMinter] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_minter')],
    program.programId
);
const [localToken] = PublicKey.findProgramAddressSync(
    [Buffer.from('local_token'), burnTokenMint.toBuffer()],
    program.programId
);
const messageSentEventDataKeyPair = Keypair.generate();
console.log("messageSentEventData:", messageSentEventDataKeyPair.publicKey.toString()); 
console.log("The secret key is stored in messageSentEventDataKeyPair-[time].json! Please keep it safe for further replacingDepositBurn if needed.");
const timestamp = Date.now();
fs.writeFileSync(`messageSentEventDataKeyPair-${timestamp}.json`, JSON.stringify(Array.from(messageSentEventDataKeyPair.secretKey)));

// HELPER FUNCTIONS
async function depositForBurn (
    amount: number,
    destChain: string,
    destAddress: string
): Promise<TransactionInstruction>{
    // Add your bridging logic here
    const depositForBurnIns = await program.methods
        .depositForBurn({
            amount,
            destinationDomain: destChains[destChain],
            mintRecipient: convertEVMAddrToSolAddr(destAddress),
        })
        .accounts({
            owner: solWallet.publicKey,
            eventRentPayer: solWallet.publicKey,
            senderAuthorityPda: senderAuthorityPda,
            burnTokenAccount: burnTokenAccount,
            messageTransmitter: messageTransmitter, 
            tokenMessenger: tokenMessenger,
            remoteTokenMessenger: getRemoteTokenMessenger(destChains[destChain]),
            tokenMinter: tokenMinter,
            localToken: localToken,
            burnTokenMint: burnTokenMint,
            messageSentEventData: messageSentEventDataKeyPair.publicKey,
            messageTransmitterProgram: messageTransmitterProgram.programId,
            tokenMessengerMinterProgram: program.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SYSTEM_PROGRAM_ID,
            eventAuthority: new PublicKey("CNfZLeeL4RUxwfPnjA3tLiQt4y43jp4V7bMpga673jf9"), // Cannot find the way to recalculate this, fixing it for now!
            program: program.programId
        })
        .instruction();
    return depositForBurnIns;
}

async function getMessage(messageSentEventData: PublicKey) {
    const messageSent: any = await messageTransmitterProgram.account.messageSent
        .fetch(messageSentEventData);
    return messageSent.message;
}

async function getAttestationFromCircleAPI(messageHash: string) {
    const url = `https://iris-api.circle.com/v1/attestations/${messageHash}`;
    console.log("url: ", url);
    while(true) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Circle API error: ${res.statusText}`);
        const data = await res.json();
        console.log("Circle API response: ", data);
    
        if (data.status === 'complete') {
            return data.attestation;
        }
    }
}

async function receiveMessageOnDestination(
    rpcUrl: string,
    privateKey: string,
    message: string,
    attestation: string,
    messageTransmitterAddress: string
) {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    const abi = [
        "function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)"
    ];
    const messageTransmitter = new ethers.Contract(messageTransmitterAddress, abi, wallet);

    console.log("Sending receiveMessage tx...");
    const tx = await messageTransmitter.receiveMessage(message, attestation);
    console.log("Tx hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("Tx confirmed in block", receipt.blockNumber);
}

function convertEVMAddrToSolAddr(evmAddr: string): PublicKey {
    const evmBytes = Buffer.from(evmAddr.replace(/^0x/, ""), "hex");
    const paddedBytes = Buffer.concat([Buffer.alloc(12, 0), evmBytes]);
    const evmBase58 = bs58.encode(paddedBytes);
    return new PublicKey(evmBase58);
}

async function replaceDepositForBurn(attestationHex: string, message: any, messageSentEventDataKeyPair: Keypair): Promise<TransactionInstruction> {
    const ins = await program.methods
        .replaceDepositForBurn({
            originalMessage: message,
            originalAttestation: Buffer.from(attestationHex.replace("0x", ""), "hex"),
            newDestinationCaller: convertEVMAddrToSolAddr("0xe45B133ddc64bE80252b0e9c75A8E74EF280eEd6"), // Example destination caller (Token Minter on Base)
            newMintRecipient: convertEVMAddrToSolAddr("0x68953f99aFd223a8794DCF6767DCA382d3db72E1"), // Example mint recipient
        })
        .accounts({
            owner: solWallet.publicKey,
            eventRentPayer: solWallet.publicKey,
            senderAuthorityPda: senderAuthorityPda,
            messageTransmitter: messageTransmitter,
            tokenMessenger: tokenMessenger,
            messageSentEventData: messageSentEventDataKeyPair.publicKey,
            messageTransmitterProgram: messageTransmitterProgram.programId,
            tokenMessengerMinterProgram: program.programId,
            systemProgram: SYSTEM_PROGRAM_ID,
            eventAuthority: new PublicKey("CNfZLeeL4RUxwfPnjA3tLiQt4y43jp4V7bMpga673jf9"), // Cannot find the way to recalculate this, fixing it for now!
            program: program.programId
        })
        .instruction();
    return ins;    
}

// MAIN FUNCTION
async function bridgeUSDCFromSolTo(
    destChain: string,
    destAddress: string,
    amount: number
) {
    // 1) burn USDC on source chain
    try {
        const instructions: TransactionInstruction[] = [];
        instructions.push(await depositForBurn(new anchor.BN(amount), destChain, destAddress));
        console.log("Instructions: ", instructions);

        const transaction = new Transaction().add(...instructions);
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = solWallet.publicKey;

        const signature = await provider.sendAndConfirm(transaction, [solWallet, messageSentEventDataKeyPair]);
        console.log("Transaction Signature: ", signature);
    } catch (error) {
        console.error('Error depositing for burning USDC from Solana:', error);
    }

    try {
        // 2) bridge USDC to destination chain
        const message = await getMessage(messageSentEventDataKeyPair.publicKey);
        console.log("Message: ", message);
        const messageHash = keccak256(message);
        console.log("Message Hash: ", messageHash);

        // 3) get attestation from Circle API
        const attestation = await getAttestationFromCircleAPI(messageHash);
        console.log("Attestation: ", attestation);
        // 4) Call receiveMessage on destination chain
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            throw new Error("PRIVATE_KEY environment variable is not set.");
        }
        await receiveMessageOnDestination(
            rpcUrl[destChain],
            privateKey,
            message,
            attestation,
            messageTransmitterAddresses[destChain]
        );
    } catch (error) {
        console.error('Error receiving message on destination chain:', error);
    }

}

bridgeUSDCFromSolTo(
    "base", // Destination chain
    "0x68953f99aFd223a8794DCF6767DCA382d3db72E1", // Destination address
    1000000 // Amount in smallest unit
);