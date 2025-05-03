// src/controllers/dnaencodeController.ts

import { Request, Response } from 'express';
import axios from 'axios';
import FormData from 'form-data';

export const encodeDNAHandler = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const response = await axios.post('http://localhost:8000/encode-dna/', form, {
      headers: form.getHeaders()
    });

    return res.json(response.data);
  } catch (error: any) {
    console.error('DNA encoding error:', error.message);
    return res.status(500).json({ error: 'DNA encoding failed' });
  }
};

