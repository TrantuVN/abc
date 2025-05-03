// IPFSapi.ts

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import IPFSRoutes from '../routes/IPFSindexRoutes'; // ✅ no .ts extension

// Load environment variables
dotenv.config();

// Initialize app
const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount IPFS routes
app.use('/api/ipfs', IPFSRoutes);

// Health check
app.get('/', (_req, res) => {
  res.send('🧬 IPFS Indexing API is up.');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 IPFS API running at http://localhost:${PORT}`);
});
