import { Request, Response, NextFunction } from 'express';
import { storeModeratedFile } from '../services/IPFSindex';

export const storeModeratedFileHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file || !req.file.buffer) {
      res.status(400).render('IPFSindex/store', { digest: 'No file uploaded' });
      return;
    }

    const { buffer, originalname, mimetype } = req.file;

    const { digest } = await storeModeratedFile(buffer, originalname, mimetype);

    // Renders an HTML view with the digest as a link
    res.status(201).render('IPFSindex/storedigest', { digest });
  } catch (error) {
    next(error);
  }
};