const fs = require('fs');
const { Readable } = require('stream');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const axios = require('axios');

// Cấu hình Pinata
const PINATA_API_KEY = 'cc4b6c4563f6d8424a5b'; // replace your API Key 
const PINATA_API_SECRET = 'ed0d5f8bb21df88bae1c36288e3bc97b8c49b6943bc9de5ec2ed481b6dba360d'; // replace your API Secret 
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
// Utility to convert Buffer to Blob
function bufferToBlob(buffer, mimeType) {
  return new Blob([Buffer.from(buffer)], { type: mimeType });
}

// Khởi tạo MongoDB client
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
async function storeModeratedFile(buffer, fileName, fileType) {
  try {
    if (!collection) {
      throw new Error('MongoDB collection not initialized');
    }

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error(`Invalid file buffer for ${fileName}, size: ${buffer.length}`);
    }

    console.log(`Starting upload to Pinata: ${fileName}, Buffer size: ${buffer.length} bytes`);

    // Chuyển Buffer thành Blob
    const blob = bufferToBlob(buffer, fileType);
    console.log(`Converted to Blob, size: ${blob.size} bytes`);

    // Tạo form data để upload lên Pinata
    const formData = new FormData();
    formData.append('file', blob, fileName);
    console.log('FormData prepared with file:', fileName);

    // Gửi request tới Pinata, để axios tự động xử lý headers
    const response = await axios.post(PINATA_API_URL, formData, {
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_API_SECRET,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
     
    });

    console.log('Pinata response received:', response.data);

    const cid = response.data.IpfsHash;
    if (!cid) {
      throw new Error('Invalid CID returned from Pinata, response: ' + JSON.stringify(response.data));
    }

    // Tạo metadata
    const metadata = {
      cid,
      fileName,
      fileType,
      uploadTimestamp: new Date(),
    };

    // Lưu vào MongoDB và lấy _id
    const insertResult = await collection.insertOne(metadata);
    const mongoId = insertResult.insertedId.toString();
    console.log('MongoDB insert successful, mongoId:', mongoId);

    // Tạo digest từ CID và MongoDB _id
    const raw = JSON.stringify({ cid, mongoId });
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
      response: err.response?.data,
      status: err.response?.status,
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