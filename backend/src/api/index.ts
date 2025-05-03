
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import DNAStorage  from '../abi/DNAStorage.json';
import { HiveModerationRoutes } from '../routes/HiveModerationRoutes';
import ipfsRoutes from '../routes/IPFSindexRoutes';
import tokenRoutes from '../routes/tokenRoutes';
import dnaRoutes from '../routes/dnaencodeRoutes';
import { ethers } from 'ethers';
import Scoin from '../abi/Scoin.json';
import { IPFSQuery } from 'src/services/IPFSindex';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors({ origin: '*' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Removed incorrect line: app.use=DNAStorageABI;

app.use('/api/moderation', HiveModerationRoutes);
app.use('/api/ipfs', ipfsRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/dna', dnaRoutes);

app.get('/', (_req, res) => res.send('🌐 Unified API is running.'));

app.listen(PORT, () => {
  console.log(`🚀 Unified API server on http://localhost:${PORT}`);
});

// Initialize ethers.js
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'default_rpc_url');
const ScoinContract = new ethers.Contract(process.env.SCOIN_ADDRESS || 'default_scoin_address', Scoin, provider);
const DNAStorageContract = new ethers.Contract(process.env.DNA_STORAGE_ADDRESS || 'default_dna_storage_address', DNAStorage, provider);

// Example function to interact with the Scoin contract
app.get('/api/scoin', async (_req, res) => {
  try {
    const data = await ScoinContract.getData();
    res.json({ data });
  } catch (error) {
    console.error('Error fetching data from Scoin:', error);
    res.status(500).send('Error fetching data');
  }
});

// Example function to interact with the DNAStorage contract
app.post('/api/dnastorage/upload', async (req, res) => {
  try {
    const { cid, filename } = req.body;
    const tx = await DNAStorageContract.uploadContent(cid);
    await tx.wait();
    res.send('Content uploaded successfully');
  } catch (error) {
    console.error('Error uploading content:', error);
    res.status(500).send('Error uploading content');
  }
});


// Example function to interact with the contract
app.get('/api/scoin', async (_req, res) => {
  try {
    const data = await ScoinContract.getData();
    res.json({ data });
  } catch (error) {
    console.error('Error fetching data from DNA Storage:', error);
    res.status(500).send('Error fetching data');
  }
});
