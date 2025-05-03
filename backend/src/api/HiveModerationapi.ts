// HiveModerationapi.ts

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { HiveModerationRoutes } from '../routes/HiveModerationRoutes';

// Load environment variables
dotenv.config();

// Create the Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route mounting
app.use('/api/moderation', HiveModerationRoutes);

// Health check endpoint
app.get('/', (_req, res) => {
  res.send('🚀 Hive Moderation API is live.');
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Hive Moderation API listening at http://localhost:${PORT}`);
});
