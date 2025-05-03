// tokenapi.ts
// src/tokenapi.ts

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import tokenRoutes from '../routes/tokenRoutes'; // ✅ No file extension

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/tokens', tokenRoutes);

app.get('/', (_req, res) => {
  res.send('🔐 Token API is live.');
});

app.listen(PORT, () => {
  console.log(`🚀 Token API running at http://localhost:${PORT}`);
});
