import path from 'path';
import { spawn } from 'child_process';
import multer from 'multer';

import { Request, Response, NextFunction } from 'express';
/**
 * Internal helper function: sends file buffer to Python script and returns DNA sequence.
 */const upload = multer();
export const encodeDNA = async (buffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    const pythonScript = path.resolve(__dirname, '../../wukong.py');
    const python = spawn('python', [pythonScript]);

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Python script failed: ${errorOutput || `exit code ${code}`}`));
      }

      const dnaseq = output.trim();
      if (!dnaseq) {
        return reject(new Error('No DNA sequence returned by script.'));
      }

      resolve(dnaseq);
    });

    // Send file buffer to Python's stdin
    python.stdin.write(buffer);
    python.stdin.end();
  });
};

/**
 * Express controller: receives file upload, encodes to DNA, responds with sequence.
 */
export const encodeDNAHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file || !req.file.buffer) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const sequence = await encodeDNA(req.file.buffer);
     // Render EJS page with the DNA sequence
    res.status(200).json(sequence);
    } catch (error: any) {
      console.error('❌ DNA encoding failed:', error.message);
      next(error);
    }
  };