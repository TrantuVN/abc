import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const execFileAsync = promisify(execFile);

// POST /api/dna/encode-dna
export const encodeDNAHandler = async (req: Request, res: Response) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Save uploaded file to a temp location
    const tempDir = path.resolve(__dirname, '../../tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const tempFilePath = path.join(tempDir, `${uuidv4()}_${file.originalname}`);
    fs.writeFileSync(tempFilePath, file.buffer);

    console.log(`📦 Saved file to ${tempFilePath}`);

    // Run wukong.py with the temp file as input
    const pythonScript = path.resolve(__dirname, '../../wukong.py');

    const { stdout, stderr } = await execFileAsync('python', [
      pythonScript,
      tempFilePath // You may need to adjust the CLI interface inside wukong.py
    ]);

    if (stderr) console.warn('⚠️ Python stderr:', stderr);

    // Clean up
    fs.unlinkSync(tempFilePath);

    // Send DNA result back
    res.status(200).json({ result: stdout.trim() });

  } catch (error: any) {
    console.error('❌ DNA encoding error:', error);
    res.status(500).json({ error: 'Encoding failed', details: error.message });
  }
};
