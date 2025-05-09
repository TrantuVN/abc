import { MongoClient, Db, Collection } from 'mongodb';
import { create } from 'ipfs-http-client';
import { Request, Response } from 'express';
import { Readable } from 'stream';

// IPFS client configuration (assumes a local or remote IPFS node)
const ipfs = create({ url: process.env.IPFS_API_URL || 'http://localhost:5001' });

// MongoDB configuration
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'ipfs_metadata';
const COLLECTION_NAME = 'files';

interface FileMetadata {
  cid: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadTimestamp: Date;
}

// Initialize MongoDB connection
let db: Db;
async function connectToMongo(): Promise<void> {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    db = client.db(DB_NAME);
    console.log('Connected to MongoDB for IPFS metadata');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

// Call the connection function when the module is loaded
connectToMongo().catch((err) => console.error('Failed to initialize MongoDB:', err));

// Store content in IPFS and index metadata in MongoDB
export async function storeContent(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Convert buffer to readable stream for IPFS
    const fileStream = Readable.from(req.file.buffer);
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;
    const fileSize = req.file.size;

    // Upload to IPFS
    const result = await ipfs.add({ path: fileName, content: fileStream });
    const cid = result.cid.toString();

    // Store metadata in MongoDB
    const metadata: FileMetadata = {
      cid,
      fileName,
      fileType,
      fileSize,
      uploadTimestamp: new Date(),
    };

    const collection: Collection<FileMetadata> = db.collection(COLLECTION_NAME);
    await collection.insertOne(metadata);

    res.status(201).json({ cid, message: 'File uploaded to IPFS and metadata indexed' });
  } catch (err) {
    console.error('Error storing content:', err);
    res.status(500).json({ error: 'Failed to store content' });
  }
}

// Retrieve content from IPFS by CID
export async function retrieveContent(req: Request, res: Response): Promise<void> {
  try {
    const cid = req.params.cid;
    const stream = ipfs.cat(cid);

    // Get metadata to set Content-Type
    const collection: Collection<FileMetadata> = db.collection(COLLECTION_NAME);
    const metadata = await collection.findOne({ cid });

    if (metadata) {
      res.setHeader('Content-Type', metadata.fileType);
    } else {
      res.setHeader('Content-Type', 'application/octet-stream');
    }

    // Stream the file content to response
    for await (const chunk of stream) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    console.error('Error retrieving content:', err);
    res.status(404).json({ error: 'Content not found or error retrieving from IPFS' });
  }
}

// List all pinned items in IPFS
export async function listPinnedItems(req: Request, res: Response): Promise<void> {
  try {
    const pinned = [];
    for await (const pin of ipfs.pin.ls()) {
      pinned.push({ cid: pin.cid.toString(), type: pin.type });
    }
    res.status(200).json({ pinned });
  } catch (err) {
    console.error('Error listing pinned items:', err);
    res.status(500).json({ error: 'Failed to list pinned items' });
  }
}

// Pin a CID to IPFS
export async function pinCID(req: Request, res: Response): Promise<void> {
  try {
    const { cid } = req.body;
    if (!cid) {
      res.status(400).json({ error: 'CID is required' });
      return;
    }

    await ipfs.pin.add(cid);
    res.status(200).json({ message: `CID ${cid} pinned successfully` });
  } catch (err) {
    console.error('Error pinning CID:', err);
    res.status(500).json({ error: 'Failed to pin CID' });
  }
}

// Unpin a CID from IPFS
export async function unpinCID(req: Request, res: Response): Promise<void> {
  try {
    const { cid } = req.body;
    if (!cid) {
      res.status(400).json({ error: 'CID is required' });
      return;
    }

    await ipfs.pin.rm(cid);
    res.status(200).json({ message: `CID ${cid} unpinned successfully` });
  } catch (err) {
    console.error('Error unpinning CID:', err);
    res.status(500).json({ error: 'Failed to unpin CID' });
  }
}

// Query the MongoDB metadata index
export async function queryIndex(req: Request, res: Response): Promise<void> {
  try {
    const { fileName, fileType, cid } = req.body;
    const query: Partial<FileMetadata> = {};

    if (fileName) query.fileName = fileName;
    if (fileType) query.fileType = fileType;
    if (cid) query.cid = cid;

    const collection: Collection<FileMetadata> = db.collection(COLLECTION_NAME);
    const results = await collection.find(query).toArray();

    res.status(200).json({ results });
  } catch (err) {
    console.error('Error querying index:', err);
    res.status(500).json({ error: 'Failed to query metadata index' });
  }
}