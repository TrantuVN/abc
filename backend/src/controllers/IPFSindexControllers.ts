import { Request, Response } from 'express';
import  { IPFSImageIndexer, IPFSManager, IPFSQuery } from '../services/IPFSindex';
import dotenv from 'dotenv';



dotenv.config();

const ipfs = new IPFSManager({
  host: 'localhost',
  port: 5001,
  protocol: 'http'
});

export const initIPFS = async () => {
    await ipfs.connect();
  };

// Upload content to IPFS
export const storeContent = async (req: Request, res: Response) => {
  try {
    const buffer = req.file?.buffer;
    if (!buffer) return res.status(400).json({ error: 'No file uploaded' });

    const result = await ipfs.store(buffer);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Retrieve content by CID
export const retrieveContent = async (req: Request, res: Response) => {
  try {
    const { cid } = req.params;
    const content = await ipfs.retrieve(cid);
    res.set('Content-Type', 'application/octet-stream');
    res.send(content);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// List all pinned items
export const listPinnedItems = async (_req: Request, res: Response) => {
  try {
    const pins = await ipfs.listPinned();
    res.json({ pins });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Pin a CID
export const pinCID = async (req: Request, res: Response) => {
  try {
    const { cid } = req.body;
    await ipfs.pin(cid);
    res.json({ pinned: cid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Unpin a CID
export const unpinCID = async (req: Request, res: Response) => {
  try {
    const { cid } = req.body;
    await ipfs.unpin(cid);
    res.json({ unpinned: cid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Query content metadata
const ipfsQuery = new IPFSQuery('http://localhost:5001');

export const queryIndex = async (req: Request, res: Response) => {
  try {
    const results = await ipfsQuery.queryIndex(req.body);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
