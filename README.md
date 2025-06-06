# Decentralized Bandwidth Marketplace

A blockchain-based bandwidth marketplace using PoS consensus, IPFS storage, and bandwidth for payments.

## Core Components

1. **Blockchain Layer**
   - PoS consensus mechanism
   - Scoin token (ERC-20)
   - Smart contracts for bandwidth trading

2. **Storage Layer**
   - IPFS integration
   - DNA Wukong encoding/decoding
   - Content addressing (CID)

3. **Payment Layer**
   - Micropayments for bandwidth
   - Reward distribution for seeders

4. **Content Management**
   - Hive Moderation system
   - Off-chain indexing
   - Search functionality

## Project Structure
```
.
├── contracts/           # Smart contracts
├── scripts/            # Deployment and test scripts
├── src/
│   ├── dna/           # DNA Wukong implementation
│   ├── ipfs/          # IPFS integration
│   ├── indexer/       # Off-chain indexer
│   ├── moderation/    # Hive moderation
│        
├── test/              # Test files
└── config/            # Configuration files
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Compile contracts:
```bash
npm run compile
```

4. Run tests:
```bash
npm test
```

## Architecture

### Bandwidth Trading Flow
1. Users stake Scoin to participate
2. Content providers seed data through IPFS
3. Consumers spend Scoin for bandwidth
5. DNA Wukong ensures content integrity
6. Hive Moderation filters content
7. Off-chain indexer enables efficient search

### Smart Contracts
- `Scoin.sol`: ERC20 token implementation
- `BandwidthMarket.sol`: Main marketplace logic
- `StakingPool.sol`: PoS staking mechanism
- `ContentRegistry.sol`: Content management

## License
MIT 