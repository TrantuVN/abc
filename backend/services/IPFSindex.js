require('dotenv').config();
const fs = require('fs');
const { Readable } = require('stream');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const PinataSDK = require('@pinata/sdk');

// Pinata SDK
const pinata = new PinataSDK({
  pinataApiKey: process.env.PINATA_API_KEY,
  pinataSecretApiKey: process.env.PINATA_API_SECRET,
  pinataGateway: process.env.PINATA_GATEWAY,
});

// Initialize MongoDB client
const mongoClient = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017');
const dbName = 'Databases';
const collectionName = 'files';

let db, collection;
async function initializeMongoDB() {
  try {
    await mongoClient.connect();
    db = mongoClient.db(dbName);
    collection = db.collection(collectionName);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw new Error('Failed to initialize MongoDB');
  }
}

initializeMongoDB().catch(err => {
  console.error('Failed to initialize MongoDB:', err);
  process.exit(1);
});

// Hàm lưu file lên Pinata và MongoDB
async function storeModeratedFile(buffer, fileName) {
  try {
    console.log(`Starting upload to Pinata: ${fileName}`);

    // Upload file to Pinata using SDK
    const result = await pinata.pinFileToIPFS(Readable.from(buffer), {
      pinataMetadata: { name: fileName },
      pinataOptions: { cidVersion: 0 },
    });
    const cid = result.IpfsHash;
    console.log('Pinata upload successful, CID:', cid);

    // Tạo metadata
    const metadata = {
      cid,
      fileName,
    };

    // Lưu vào MongoDB
    const insertResult = await collection.insertOne(metadata);
    const mongoId = insertResult.insertedId.toString();
    console.log('MongoDB insert successful, mongoId:', mongoId);

    // Tạo digest
    const raw = JSON.stringify({ cid });
    const digest = crypto.createHash('sha256').update(raw).digest('hex');

    // Cập nhật document với digest
    await collection.updateOne(
      { _id: insertResult.insertedId },
      { $set: { digest } }
    );
    console.log(`Stored file with CID: ${cid}, Digest: ${digest}`);

    return { cid, digest, mongoId };
  } catch (err) {
    console.error('Error in storeModeratedFile:', {
      message: err.message,
      stack: err.stack,
      fileName,
    });
    throw new Error(`Failed to store file: ${err.message}`);
  }
}

process.on('SIGINT', async () => {
  try {
    await mongoClient.close();
    console.log('MongoDB connection closed');
  } catch (err) {
    console.error('Error closing MongoDB:', err);
  }
  process.exit(0);
});

module.exports = storeModeratedFile;