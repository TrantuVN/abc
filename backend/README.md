# SCOIN System

This is the core integration for the SCOIN blockchain-based content sharing system.

## Architecture

The SCOIN system consists of three main layers:

### Layer 1: Application Backend & Off-chain Services
- Backend API (Express.js)
- MongoDB (Metadata storage)
- Hive Moderation (AI-based content moderation)
- Search API

### Layer 2: Decentralized Storage
- IPFS network integration
- Storage provider software for seeders

### Layer 3: Core Blockchain Layer
- Smart contracts (Scoin.sol, ContentManager.sol, etc.)
- Blockchain consensus
- Token economics

## Setup Instructions

### Prerequisites
- Node.js (v14+)
- MongoDB
- IPFS node
- Ethereum node or testnet access
- Python 3.8+ (for AI moderation)

### Installation

1. Clone the repository:
```
git clone https://github.com/yourusername/scoin.git
cd scoin
```

2. Install dependencies:
```
npm install
cd backend
npm install
```

3. Set up environment variables:
```
cp .env.example .env
# Edit .env with your configuration values
```

4. Deploy smart contracts (if not already deployed):
```
npx hardhat run scripts/deploy.js --network your_network
```

5. Start MongoDB:
```
mongod --dbpath=/path/to/data/db
```

6. Start IPFS daemon:
```
ipfs daemon
```

7. Start the AI moderation service:
```
cd backend/server\ side
pip install -r requirements.txt
python app.py
```

8. Start the integration server:
```
node integration.js
```

## API Documentation

### Content Upload
`POST /api/content/upload`

Uploads content to the platform, processes it through all three layers.

**Parameters:**
- `file`: The file to upload (multipart/form-data)
- `contentType`: MIME type of the content
- `address`: Ethereum address of the uploader

### Content Search
`GET /api/content/search`

Searches for content across the platform.

**Parameters:**
- `query`: Text search query
- `contentType`: Filter by content type
- `timeStart`: Start timestamp
- `timeEnd`: End timestamp
- `owner`: Filter by owner address
- `onlyApproved`: Filter for approved content only

### Content Retrieval
`GET /api/content/:cid`

Retrieves content by its Content Identifier (CID).

### Bandwidth Purchase
`POST /api/bandwidth/purchase`

Purchases bandwidth allocation for content uploads.

**Parameters:**
- `amount`: Amount of bandwidth to purchase
- `address`: Ethereum address of the purchaser

## License

MIT 