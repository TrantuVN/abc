const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const { create } = require('ipfs-http-client');

const ipfs = create({ url: process.env.IPFS_API_URL || 'http://localhost:5001' });
const mongoClient = new MongoClient(process.env.MONGO_URI || 'mongodb://localhost:27017');
const dbName = 'metadata';
const collectionName = 'files';

async function storeModeratedFile(buffer, fileName, fileType) {
  if (!mongoClient.topology || !mongoClient.topology.isConnected()) {
    await mongoClient.connect();
  }

  const db = mongoClient.db(dbName);
  const collection = db.collection(collectionName);

  const fileStream = Readable.from(buffer);
  const fileSize = buffer.length;
  const result = await ipfs.add({ path: fileName, content: fileStream });
  const cid = result.cid.toString();

  const metadata = {
    cid,
    fileName,
    fileType,
    fileSize,
    uploadTimestamp: new Date(),
  };

  const raw = JSON.stringify({
    cid,
    fileName,
    fileType,
    fileSize,
  });

  const digest = crypto.createHash('sha256').update(raw).digest('hex');
  await collection.insertOne({ ...metadata, digest });

  return { digest };
}

module.exports = storeModeratedFile;
