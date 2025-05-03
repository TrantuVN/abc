# Deployment Guide

## Prerequisites
- Node.js (v14 or higher)
- IPFS daemon running locally or a remote IPFS node
- MongoDB (v4.4 or higher)
- Hardhat for smart contract deployment
- Git (for version control)

## Initial Setup

1. Clone the repository and install root dependencies:
   ```bash
   git clone <repository-url>
   cd Scoin
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Required variables in .env:
   - MONGO_URL: MongoDB connection string
   - IPFS_HOST, IPFS_PORT, IPFS_PROTOCOL: IPFS node configuration
   - RPC_URL: Blockchain network RPC endpoint
   - HIVE_API_KEY, HIVE_API_TOKEN: Content moderation API credentials
   - PORT: Backend server port

## Smart Contract Deployment

1. Compile smart contracts:
   ```bash
   npx hardhat compile
   ```

2. Deploy contracts to your chosen network:
   ```bash
   npx hardhat run deploy.js --network <network-name>
   ```
   
3. Update .env with deployed contract addresses:
   - CONTENT_MANAGER_ADDRESS
   - CONTENT_QUERY_ADDRESS

## Backend Deployment

1. Set up backend:
   ```bash
   cd backend
   npm install
   ```

2. Configure MongoDB:
   - Ensure MongoDB is running
   - Verify MONGO_URL in .env points to your database
   - Create required collections if needed

3. Build TypeScript files:
   ```bash
   npm run build
   ```

4. Start the server:
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## Frontend Deployment

1. Set up frontend:
   ```bash
   cd frontend
   npm install
   ```

2. Configure environment:
   - Copy and edit .env file with:
     - VITE_API_URL: Backend API endpoint
     - VITE_IPFS_GATEWAY: IPFS gateway URL
     - VITE_CONTRACT_ADDRESSES: Smart contract addresses

3. Development mode:
   ```bash
   npm run dev
   ```

4. Production build:
   ```bash
   npm run build
   npm run preview # To test the build
   ```

## IPFS Configuration

1. Ensure IPFS daemon is running:
   ```bash
   ipfs daemon
   ```

2. Configure IPFS in backend `.env`:
   ```
   IPFS_HOST=localhost
   IPFS_PORT=5001
   IPFS_PROTOCOL=http
   ```

## Security Considerations

1. Environment Security:
   - Use strong, unique values for all secrets
   - Store sensitive data in environment variables
   - Never commit .env files to version control

2. Network Security:
   - Configure CORS in backend/src/server.ts:
     ```typescript
     app.use(cors({
       origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
       methods: ['GET', 'POST'],
       credentials: true
     }));
     ```
   - Set up SSL/TLS certificates for production
   - Use secure WebSocket connections if applicable

3. Database Security:
   - Enable MongoDB authentication
   - Use connection pooling
   - Implement proper access controls

4. Smart Contract Security:
   - Monitor contract events for suspicious activity
   - Implement emergency pause functionality
   - Regular security audits

## Monitoring & Logging

1. Application Monitoring:
   ```bash
   # Install PM2 for process management
   npm install -g pm2
   
   # Start backend with PM2
   cd backend
   pm2 start npm --name "scoin-backend" -- start
   
   # Monitor logs
   pm2 logs scoin-backend
   ```

2. IPFS Health Checks:
   - Monitor node connectivity
   - Track pinned content size
   - Set up alerts for node issues

3. Smart Contract Monitoring:
   - Track transaction volume
   - Monitor gas costs
   - Set up event listeners

## Maintenance

1. Database Management:
   ```bash
   # Backup MongoDB database
   mongodump --uri="$MONGO_URL" --out=./backup
   
   # Restore if needed
   mongorestore --uri="$MONGO_URL" ./backup
   ```

2. Storage Management:
   - Regular IPFS garbage collection
   - Monitor disk usage thresholds
   - Implement content retention policies

3. Updates:
   ```bash
   # Update npm packages
   npm audit
   npm update
   
   # Update smart contracts (if needed)
   npx hardhat compile
   npx hardhat run deploy.js --network <network-name>
   ```