import { Request, Response } from 'express';
import dotenv from 'dotenv';
import express from 'express';
import { create } from 'ipfs-http-client'



dotenv.config();

const ipfs = create({
  host: '127.0.0.1',
  port: 5001,
  protocol: 'http'
});

export const initIPFS = async () => {
    // IPFS client doesn't require explicit connection as it's handled internally
    return;
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
    try {
      await ipfs.id();
    } catch {
      try {
        // IPFS client auto-connects, no explicit connect needed
        await ipfs.id(); // Verify connection by checking node ID
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
      const result = await ipfs.add(buffer);
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
    const content = await ipfs.cat(cid);
    res.set('Content-Type', 'application/octet-stream');
    res.send(content);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// List all pinned items
export const listPinnedItems = async (_req: Request, res: Response) => {
  try {
    const pins = await ipfs.pin.ls();
    res.json({ pins });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Pin a CID
export const pinCID = async (req: Request, res: Response) => {
  try {
    const { cid } = req.body;
    await ipfs.pin.add(cid);
    res.json({ pinned: cid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Unpin a CID
export const unpinCID = async (req: Request, res: Response) => {
  try {
    const { cid } = req.body;
    await ipfs.pin.rm(cid);
    res.json({ unpinned: cid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Query content metadata
// TODO: Define or import IPFSQuery class before using it
const ipfsQuery = ipfs;

export const queryIndex = async (req: Request, res: Response) => {
  try {
    // Use appropriate IPFS methods based on your query requirements
    const results = await ipfs.dag.get(req.body.cid);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const ipfsRoutes = express.Router();
