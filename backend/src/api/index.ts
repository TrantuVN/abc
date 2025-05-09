import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import { ethers } from 'ethers';
import axios from 'axios';
import FormData from 'form-data';
import { MongoClient } from 'mongodb';
import { HiveModerationRoutes } from '../routes/HiveModerationRoutes';
import ipfsRoutes from '../routes/IPFSindexRoutes';
import tokenRoutes from '../routes/tokenRoutes';
import dnaRoutes from '../routes/dnaencodeRoutes';
import path from 'path';
import fs from 'fs/promises';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Validate required environment variables
const requiredEnvVars = [
  'RPC_URL',
  'PRIVATE_KEY',
  'SCOIN_ADDRESS',
  'DNA_STORAGE_ADDRESS',
  'HIVE_API_KEY',
  'MONGO_URL',
  'IPFS_HOST',
  'IPFS_PORT',
  'IPFS_PROTOCOL',
];
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error(`Missing environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Verify SCOIN_ADDRESS matches DNA_STORAGE_ADDRESS
if (process.env.SCOIN_ADDRESS !== process.env.DNA_STORAGE_ADDRESS) {
  console.warn('SCOIN_ADDRESS and DNA_STORAGE_ADDRESS should be the same');
}

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });

// MongoDB setup
const mongoClient = new MongoClient(process.env.MONGO_URL as string);
const dbName = process.env.MONGO_DB_NAME || 'content_dev';
let db: any;

async function connectMongoDB() {
  try {
    await mongoClient.connect();
    db = mongoClient.db(dbName);
    console.log('✅ Connected to MongoDB');
  } catch (error: any) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('Please ensure your MongoDB server is running and the MONGO_URL is correct.');
    process.exit(1);
  }
}
connectMongoDB().catch(console.error);

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5175', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Blockchain setup
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL as string);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);
const signer = wallet;

console.log(`Backend wallet connected with address: ${wallet.address}`);

const scoinABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function storeCID(string cid) returns (bool)',
  'event CIDStored(address indexed user, string cid)',
];
const storageContract = new ethers.Contract(process.env.SCOIN_ADDRESS as string, scoinABI, signer);

// Utility function to index metadata
const indexMetadata = async (metadata: {
  filename: string;
  fileCid: string;
  dnaCid?: string;
  moderated: any;
  uploadedAt: Date;
  walletAddress: string;
  type: 'file' | 'dna';
}): Promise<void> => {
  try {
    if (!db) {
      throw new Error('MongoDB not connected');
    }
    await db.collection('metadata').insertOne(metadata);
    console.log('✅ Indexed metadata:', metadata);
  } catch (error: any) {
    console.error('❌ MongoDB indexing failed:', error.message);
    throw new Error('Failed to index metadata: ' + error.message);
  }
};

// DNA encoding handler
export const encodeDNAHandler = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File required' });
  }

  try {
    const tempFilePath = path.join(__dirname, 'temp', req.file.originalname);
    await fs.mkdir(path.dirname(tempFilePath), { recursive: true });
    await fs.writeFile(tempFilePath, req.file.buffer);

    // External DNA encoding service
    const response = await axios.post('https://external-dna-encoding-service.com/encode', {
      filePath: tempFilePath
    });

    const encoded = response.data.encoded;
    res.json({ encoded });
  } catch (error: any) {
    console.error('DNA encoding error:', error.message);
    res.status(500).json({ error: 'DNA encoding failed', details: error.message });
  }
};

// Routes
app.use('/api/moderation', HiveModerationRoutes);
app.use('/api/ipfs', ipfsRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/dna', dnaRoutes);

// Root route
app.get('/', (_req, res) => res.send('🌐 Unified API is running.'));

// File upload to IPFS and blockchain
app.post('/api/upload/file', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const buffer = req.file.buffer;
    const filename = req.file.originalname;
    const mimetype = req.file.mimetype;

    console.log('Starting file upload process for:', filename);
    const BASE_URL = process.env.NODE_ENV === 'production' ? 'https://your-backend.onrender.com' : `http://localhost:${PORT}`;

    // 1. Moderate file
    const formData = new FormData();
    formData.append('file', buffer, { filename, contentType: mimetype });
    const moderationResponse = await axios.post(
      `${BASE_URL}/api/moderation/moderate`,
      formData,
      { headers: formData.getHeaders() }
    );
    const moderationResult = moderationResponse.data;
    if (!moderationResult.isAllowed) {
      return res.status(403).json({ error: 'File rejected by moderation', details: moderationResult });
    }

    // 2. Upload file to IPFS
    const ipfsForm = new FormData();
    ipfsForm.append('file', buffer, { filename, contentType: mimetype });
    const ipfsResponse = await axios.post(
      `${BASE_URL}/api/ipfs/store`,
      ipfsForm,
      { headers: ipfsForm.getHeaders() }
    );
    const fileCid = ipfsResponse.data.cid;

    // 3. Store CID on blockchain
    const tx = await storageContract.storeCID(fileCid, { gasLimit: 200000 });
    const receipt = await tx.wait();

    // 4. Index metadata in MongoDB
    await indexMetadata({
      filename,
      fileCid,
      moderated: moderationResult,
      uploadedAt: new Date(),
      walletAddress: wallet.address,
      type: 'file',
    });

    // 5. Respond
    const balance = await storageContract.balanceOf(wallet.address);
    const totalSupply = await storageContract.totalSupply();

    res.json({
      filename,
      fileCid,
      transactionHash: receipt.transactionHash,
      moderation: moderationResult,
      scoinBalance: ethers.utils.formatEther(balance),
      totalSupply: ethers.utils.formatEther(totalSupply),
    });
  } catch (error: any) {
    console.error('File upload failed:', error);
    res.status(500).json({
      error: 'Failed to process file upload',
      details: error.message,
    });
  }
});

// DNA upload with encoding
app.post('/api/dna/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File required' });
    }

    const buffer = req.file.buffer;
    const filename = req.file.originalname;
    const mimetype = req.file.mimetype;

    console.log('Starting DNA upload process for:', filename);
    const BASE_URL = process.env.NODE_ENV === 'production' ? 'https://your-backend.onrender.com' : `http://localhost:${PORT}`;

    // 1. Moderate file
    const formData = new FormData();
    formData.append('file', buffer, { filename, contentType: mimetype });
    const moderationResponse = await axios.post(
      `${BASE_URL}/api/moderation/moderate`,
      formData,
      { headers: formData.getHeaders() }
    );
    const moderationResult = moderationResponse.data;
    if (!moderationResult.isAllowed) {
      return res.status(403).json({ error: 'File rejected by moderation', details: moderationResult });
    }

    // 2. Encode file to DNA using external service
    const response = await axios.post('https://external-dna-encoding-service.com/encode', {
      filePath: path.join(__dirname, 'temp', filename)
    });

    const encodedDNA = response.data.encoded;

    // 3. Upload file to IPFS
    const ipfsForm = new FormData();
    ipfsForm.append('file', buffer, { filename, contentType: mimetype });
    const ipfsResponse = await axios.post(
      `${BASE_URL}/api/ipfs/store`,
      ipfsForm,
      { headers: ipfsForm.getHeaders() }
    );
    const fileCid = ipfsResponse.data.cid;

    // 4. Upload DNA sequences to IPFS
    const dnaContent = Buffer.from(JSON.stringify(encodedDNA));
    const dnaForm = new FormData();
    dnaForm.append('file', dnaContent, { filename: `${filename}.dna.json`, contentType: 'application/json' });
    const dnaIpfsResponse = await axios.post(
      `${BASE_URL}/api/ipfs/store`,
      dnaForm,
      { headers: dnaForm.getHeaders() }
    );
    const dnaCid = dnaIpfsResponse.data.cid;

    // 5. Store DNA CID on blockchain
    const tx = await storageContract.storeCID(dnaCid, { gasLimit: 200000 });
    const receipt = await tx.wait();

    // 6. Index metadata in MongoDB
    await indexMetadata({
      filename,
      fileCid,
      dnaCid,
      moderated: moderationResult,
      uploadedAt: new Date(),
      walletAddress: wallet.address,
      type: 'dna',
    });

    // 7. Respond
    const balance = await storageContract.balanceOf(wallet.address);
    const totalSupply = await storageContract.totalSupply();

    res.json({
      filename,
      fileCid,
      dnaCid,
      encoded: encodedDNA,
      transactionHash: receipt.transactionHash,
      moderation: moderationResult,
      scoinBalance: ethers.utils.formatEther(balance),
      totalSupply: ethers.utils.formatEther(totalSupply),
    });
  } catch (error: any) {
    console.error('DNA upload failed:', error.message);
    res.status(500).json({ error: 'Failed to process DNA upload', details: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Unified API server on http://localhost:${PORT}`);
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is in use. Try a different port.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing MongoDB connection...');
  await mongoClient.close();
  process.exit(0);
});