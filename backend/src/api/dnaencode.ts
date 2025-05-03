// dnaencodeApi.ts

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import dnaencodeRoutes from '../routes/dnaencodeRoutes'; // 

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 8001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount DNA encoding route
app.use('/api/dna', dnaencodeRoutes);

// Health check
app.get('/', (_req, res) => {
  res.send('🧬 DNA Encode API is live.');
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 DNA Encode API running at http://localhost:${PORT}`);
});
