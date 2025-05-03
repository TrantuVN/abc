/**
 * SCOIN System Integration
 * This file connects the three layers of the SCOIN architecture:
 * 1. Application Backend (Layer 1)
 * 2. Decentralized Storage (Layer 2)
 * 3. Blockchain (Layer 3)
 */

const express = require('express');
const cors = require('cors');
const { Web3 } = require('web3');
const { MongoClient } = require('mongodb');
const IPFS = require('ipfs-http-client');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Smart contract ABIs
const ScoinABI = require('../contracts/artifacts/Scoin.json').abi;
const ContentManagerABI = require('../contracts/artifacts/ContentManager.json').abi;
const ContentQueryABI = require('../contracts/artifacts/ContentQuery.json').abi;
const BandwidthMarketABI = require('../contracts/artifacts/BandwidthMarket.json').abi;

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json());

// ==========================================
// LAYER 3: BLOCKCHAIN CONNECTIONS
// ==========================================
class BlockchainService {
  constructor() {
    this.web3 = new Web3(process.env.ETHEREUM_RPC_URL || 'http://localhost:8545');
    
    this.scoinContract = new this.web3.eth.Contract(
      ScoinABI,
      process.env.SCOIN_CONTRACT_ADDRESS
    );
    
    this.contentManagerContract = new this.web3.eth.Contract(
      ContentManagerABI,
      process.env.CONTENT_MANAGER_ADDRESS
    );
    
    this.contentQueryContract = new this.web3.eth.Contract(
      ContentQueryABI,
      process.env.CONTENT_QUERY_ADDRESS
    );
    
    this.bandwidthMarketContract = new this.web3.eth.Contract(
      BandwidthMarketABI,
      process.env.BANDWIDTH_MARKET_ADDRESS
    );
    
    this.adminAccount = process.env.ADMIN_ACCOUNT;
  }
  
  async submitContent(cid, size, owner) {
    return this.contentManagerContract.methods.submitContent(cid, size)
      .send({ from: owner, gas: 300000 });
  }
  
  async submitAIModeration(cid, approved, confidence) {
    return this.contentManagerContract.methods.submitAIModeration(cid, approved, confidence)
      .send({ from: this.adminAccount, gas: 300000 });
  }
  
  async queryContent(parameters) {
    const { timeStart, timeEnd, onlyApproved } = parameters;
    return this.contentQueryContract.methods.queryContentByTimeRange(
      timeStart || 0,
      timeEnd || Math.floor(Date.now() / 1000),
      onlyApproved || false
    ).call();
  }
  
  async purchaseBandwidth(amount, account) {
    return this.contentManagerContract.methods.purchaseBandwidth(amount)
      .send({ from: account, gas: 300000 });
  }
}

// ==========================================
// LAYER 2: DECENTRALIZED STORAGE (IPFS)
// ==========================================
class IPFSService {
  constructor() {
    this.ipfs = IPFS.create({
      host: process.env.IPFS_HOST || 'localhost',
      port: process.env.IPFS_PORT || 5001,
      protocol: process.env.IPFS_PROTOCOL || 'http'
    });
    
    this.storagePath = path.join(__dirname, 'storage');
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }
  
  async uploadToIPFS(content, metadata = {}) {
    const buffer = Buffer.from(content);
    const result = await this.ipfs.add({
      content: buffer,
      ...metadata
    });
    
    return {
      cid: result.path,
      size: result.size
    };
  }
  
  async retrieveFromIPFS(cid) {
    const chunks = [];
    for await (const chunk of this.ipfs.cat(cid)) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  
  // Storage provider functionality
  async startSeeding(cid) {
    try {
      const content = await this.retrieveFromIPFS(cid);
      const filePath = path.join(this.storagePath, cid);
      fs.writeFileSync(filePath, content);
      return { success: true, path: filePath };
    } catch (error) {
      console.error(`Error seeding content ${cid}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  getSeededContent() {
    return fs.readdirSync(this.storagePath);
  }
}

// ==========================================
// LAYER 1: APPLICATION BACKEND
// ==========================================

// MongoDB Connection
class DatabaseService {
  constructor() {
    this.client = null;
    this.db = null;
  }
  
  async connect() {
    this.client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
    await this.client.connect();
    this.db = this.client.db(process.env.MONGODB_DB || 'scoinMetadata');
    
    // Create indexes
    await this.db.collection('content').createIndex({ cid: 1 }, { unique: true });
    await this.db.collection('content').createIndex({ owner: 1 });
    await this.db.collection('content').createIndex({ contentType: 1, isApproved: 1 });
    await this.db.collection('content').createIndex({ timestamp: -1 });
    await this.db.collection('content').createIndex({ $text: { $search: "" } });
    
    console.log('Connected to MongoDB');
    return this.db;
  }
  
  async saveContent(contentData) {
    return this.db.collection('content').insertOne({
      ...contentData,
      timestamp: new Date()
    });
  }
  
  async getContent(query) {
    return this.db.collection('content').find(query).toArray();
  }
  
  async updateContent(cid, updates) {
    return this.db.collection('content').updateOne(
      { cid }, 
      { $set: updates }
    );
  }
}

// Hive Moderation Service Integration
class ModerationService {
  constructor() {
    this.apiEndpoint = process.env.MODERATION_API || 'http://localhost:5000/analyze';
  }
  
  async moderateContent(content, contentType) {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: Buffer.from(content).toString('base64'),
          contentType,
          contentHash: this.hashContent(content)
        })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Moderation error:', error);
      return { 
        approved: false, 
        confidence: 0, 
        error: error.message 
      };
    }
  }
  
  hashContent(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(Buffer.from(content)).digest('hex');
  }
}

// ==========================================
// SYSTEM INITIALIZATION
// ==========================================
const blockchain = new BlockchainService();
const ipfs = new IPFSService();
const database = new DatabaseService();
const moderation = new ModerationService();

// Initialize all services
async function initializeServices() {
  try {
    await database.connect();
    console.log('All services initialized');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// ==========================================
// API ROUTES
// ==========================================

// Content Upload (connects all three layers)
app.post('/api/content/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { contentType, address } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    // Step 1: Moderate content using Hive Moderation (Layer 1)
    const moderationResult = await moderation.moderateContent(file.buffer, contentType);
    
    // Step 2: Upload to IPFS if approved or pending moderation (Layer 2)
    const ipfsResult = await ipfs.uploadToIPFS(file.buffer, { contentType });
    
    // Step 3: Store metadata in MongoDB (Layer 1)
    const contentData = {
      cid: ipfsResult.cid,
      size: ipfsResult.size,
      contentType,
      owner: address,
      isModerated: moderationResult.isAI || false,
      isApproved: moderationResult.approved,
      moderationConfidence: moderationResult.confidence || 0
    };
    
    await database.saveContent(contentData);
    
    // Step 4: Submit to blockchain (Layer 3)
    await blockchain.submitContent(ipfsResult.cid, ipfsResult.size, address);
    
    // Step 5: Submit moderation results to blockchain if already moderated
    if (moderationResult.isAI) {
      await blockchain.submitAIModeration(
        ipfsResult.cid, 
        moderationResult.approved, 
        Math.floor(moderationResult.confidence * 100)
      );
      
      // Step 6: Start seeding if content is approved (Layer 2)
      if (moderationResult.approved) {
        await ipfs.startSeeding(ipfsResult.cid);
      }
    }
    
    res.json({
      success: true,
      cid: ipfsResult.cid,
      moderation: moderationResult
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Content Search (Layer 1 + Layer 3)
app.get('/api/content/search', async (req, res) => {
  try {
    const { query, contentType, timeStart, timeEnd, owner, onlyApproved } = req.query;
    
    // Build MongoDB query
    const dbFilter = {};
    if (contentType) dbFilter.contentType = contentType;
    if (owner) dbFilter.owner = owner;
    if (onlyApproved === 'true') dbFilter.isApproved = true;
    
    if (timeStart || timeEnd) {
      dbFilter.timestamp = {};
      if (timeStart) dbFilter.timestamp.$gte = new Date(parseInt(timeStart));
      if (timeEnd) dbFilter.timestamp.$lte = new Date(parseInt(timeEnd));
    }
    
    if (query) {
      dbFilter.$text = { $search: query };
    }
    
    // Query MongoDB for metadata
    const results = await database.getContent(dbFilter);
    
    // Query blockchain for additional content if needed
    if (results.length < 10) {
      const blockchainResults = await blockchain.queryContent({
        timeStart: parseInt(timeStart) / 1000,
        timeEnd: parseInt(timeEnd) / 1000,
        onlyApproved: onlyApproved === 'true'
      });
      
      // Add blockchain results not already in MongoDB
      const knownCids = new Set(results.map(r => r.cid));
      for (const cid of blockchainResults) {
        if (!knownCids.has(cid)) {
          // Get details from blockchain and add to results
          const details = await blockchain.contentManagerContract.methods.getContentDetails(cid).call();
          results.push({
            cid,
            owner: details.owner,
            timestamp: new Date(details.timestamp * 1000),
            isModerated: details.isModerated,
            isApproved: details.isApproved,
            size: parseInt(details.bandwidthAllocation),
            fromBlockchain: true
          });
        }
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Content Retrieval (Layer 2)
app.get('/api/content/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    
    // Get content details from database
    const [contentDetails] = await database.getContent({ cid });
    
    if (!contentDetails) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    if (contentDetails.isModerated && !contentDetails.isApproved) {
      return res.status(403).json({ error: 'Content not approved' });
    }
    
    // Retrieve from IPFS
    const content = await ipfs.retrieveFromIPFS(cid);
    
    // Set appropriate content type
    res.setHeader('Content-Type', contentDetails.contentType || 'application/octet-stream');
    res.send(content);
  } catch (error) {
    console.error('Content retrieval error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bandwidth Purchase (Layer 3)
app.post('/api/bandwidth/purchase', async (req, res) => {
  try {
    const { amount, address } = req.body;
    
    if (!amount || !address) {
      return res.status(400).json({ error: 'Amount and address are required' });
    }
    
    const result = await blockchain.purchaseBandwidth(amount, address);
    
    res.json({
      success: true,
      transaction: result.transactionHash
    });
  } catch (error) {
    console.error('Bandwidth purchase error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// SERVER STARTUP
// ==========================================
async function startServer() {
  await initializeServices();
  
  app.listen(PORT, () => {
    console.log(`SCOIN System running on port ${PORT}`);
  });
}

startServer().catch(console.error);

module.exports = { app, blockchain, ipfs, database, moderation }; 