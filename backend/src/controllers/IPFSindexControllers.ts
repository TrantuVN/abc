import { Request, Response } from 'express';
import  { IPFSManager, IPFSQuery } from '../services/IPFSindex';
import dotenv from 'dotenv';
import express from 'express';



dotenv.config();

const ipfs = new IPFSManager({
  host: '127.0.0.1',
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
// 
    if (!buffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check IPFS connection status
    if (!ipfs.isConnected()) {
      try {
        await ipfs.connect();
      } catch (connError: any) {
        console.error('IPFS Connection Error:', connError);
        return res.status(503).json({
          error: 'IPFS Connection Error',
          details: 'Unable to connect to IPFS node. Please ensure IPFS daemon is running.',
          message: connError.message
        });
      }
    }

    try {
      const result = await ipfs.store(buffer);
      res.json(result);
    } catch (uploadError: any) {
      console.error('IPFS Upload Error:', uploadError);
      return res.status(503).json({
        error: 'IPFS Upload Failed',
        details: 'Failed to upload content to IPFS. Please check your network connection.',
        message: uploadError.message
      });
    }
  } catch (error: any) {
    console.error('Unexpected Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: 'An unexpected error occurred while processing your request.',
      message: error.message
    });
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

export const ipfsRoutes = express.Router();
