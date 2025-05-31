import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cors from 'cors';
import axios from 'axios';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { moderate } from '../services/HiveModeration';

interface ModerateBody {
  text: string;
  [key: string]: any;
}


dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: 'http://localhost:5173' })); // allow frontend to access

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ storage: multer.memoryStorage() }); // using buffer to no saving files
// Routes
// ---------------------------

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ message: 'Welcome to Scoin backend API' });
});

// Encode DNA
app.post('/encode-dna', (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');

  const filePath = req.file.path;
  const scriptPath = './wukong.py';

  execFile('python', [scriptPath, filePath], (error, stdout, stderr) => {
    if (error) {
      console.error('Python error:', stderr || error.message);
      return res.status(500).json({ message: 'Encoding failed', error: stderr || error.message });
    }

    const res_dna_seq = stdout.trim();
    res.json({ res_dna_seq });
  });
});
app.post('/hive', async (req: Request<{}, {}, ModerateBody>, res: Response) => {
  const dataToModerate: ModerateBody = req.body;

  if (!dataToModerate || Object.keys(dataToModerate).length === 0 || typeof dataToModerate.text !== 'string' || dataToModerate.text.trim().length === 0) {
      return res.status(400)
  }

  try {
      const moderate: ModerateBody = await moderate(dataToModerate);
      res.json({
          class: moderate.class,
          score: moderate.score
      });
  } catch (error: any) {;
      res.status(500)
  }
});

app.get('/hash'), (req, res) => {
  

}