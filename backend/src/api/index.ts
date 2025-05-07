// src/index.ts
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import DNAStorageABI from '../abi/DNAStorage.json';
import ScoinABI from '../abi/Scoin.json';
import { ethers } from 'ethers';
import { HiveModerationRoutes } from '../routes/HiveModerationRoutes';
import ipfsRoutes from '../routes/IPFSindexRoutes';
import tokenRoutes from '../routes/tokenRoutes';
import dnaRoutes from '../routes/dnaencodeRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routers
app.use('/api/moderation', HiveModerationRoutes);
app.use('/api/ipfs', ipfsRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/dna', dnaRoutes);

// Root route
app.get('/', (_req, res) => res.send('🌐 Unified API is running.'));

// Blockchain setup
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');
const backendPrivateKey = process.env.BACKEND_PRIVATE_KEY;

let wallet: ethers.Wallet | undefined;
let signer: ethers.Signer | undefined;

if (backendPrivateKey) {
  try {
    wallet = new ethers.Wallet(backendPrivateKey, provider);
    signer = wallet;
    console.log(`Backend wallet connected with address: ${wallet.address}`);
  } catch (error) {
    console.error("Error initializing backend wallet:", error);
    console.warn("Backend will not be able to send transactions to the blockchain.");
  }
} else {
  console.warn("BACKEND_PRIVATE_KEY not found in environment variables.");
}

const ScoinContract = new ethers.Contract(process.env.SCOIN_ADDRESS || '0x...', ScoinABI, provider);
const DNAStorageContract = new ethers.Contract(process.env.DNA_STORAGE_ADDRESS || '0x...', DNAStorageABI, signer || provider);

// Read-only Scoin route
app.get('/api/scoin', async (_req, res) => {
  try {
    const data = await ScoinContract.getData();
    res.json({ data });
  } catch (error) {
    console.error('Error fetching data from Scoin contract:', error);
    res.status(500).send('Error fetching data from Scoin contract');
  }
});

// Write to DNAStorage contract
app.post('/api/dnastorage/upload', async (req, res) => {
  if (!signer) {
    console.error("Backend signer not initialized.");
    return res.status(500).send('Backend is not configured to send blockchain transactions.');
  }

  try {
    const { cid, filename } = req.body;
    if (!cid || typeof cid !== 'string') {
      return res.status(400).send('Missing or invalid "cid" in request body.');
    }

    const tx = await DNAStorageContract.uploadContent(cid);
    console.log(`Sending transaction to DNAStorageContract with CID: ${cid}`);
    console.log(`Transaction hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

    res.json({ message: 'Content recorded on blockchain successfully', txHash: receipt.transactionHash });
  } catch (error: any) {
    console.error('Error recording content on DNAStorage contract:', error);
    if (error.message?.includes("insufficient funds")) {
      res.status(500).send('Backend account has insufficient funds to send transaction.');
    } else {
      res.status(500).send('Error recording content on blockchain.');
    }
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Unified API server on http://localhost:${PORT}`);
});
