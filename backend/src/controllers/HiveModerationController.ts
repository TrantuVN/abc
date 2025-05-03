// controllers/HiveModerationController.ts

import { Request, Response } from 'express';
import HiveModeration from '../services/HiveModeration';

const hive = new HiveModeration();

export const moderateContent = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const buffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    const metadata = { cid: 'temp-placeholder' }; // You can replace this with actual file metadata or CID

    const result = await hive.moderateFile(buffer, mimeType, metadata);

    res.status(200).json({
      isAllowed: result.isAccepted,
      confidence: result.confidence,
      categories: result.categories,
      details: result.moderationDetails
    });
  } catch (err: any) {
    console.error('Moderation failed:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
