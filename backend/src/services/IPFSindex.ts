import { create } from 'ipfs-http-client';
import { EventEmitter } from 'events';
import { MongoClient, Collection, Document, WithId } from 'mongodb';

// Interfaces
interface IPFSConfig {
    host: string;
    port: number;
    protocol: string;
}

interface StorageMetadata {
    cid: string;
    size: number;
    timestamp: number;
}

export interface IPFSQueryResult {
    cid: string;
    content: any;
    metadata: {
        provider: string;
        timestamp: number;
        size: number;
        type: string;
    };
}

export interface ContentMetadata {
    title?: string;
    description?: string;
    tags?: string[];
    creator: string;
    timestamp: number;
    contentType: string;
    size: number;
    durability?: 'temporary' | 'standard' | 'replicated';
    metadataCid?: string;
}

export interface IPFSContent {
    cid: string;
    size: number;
    metadata: ContentMetadata;
    isEncrypted: boolean;
    url?: string;
    path?: string;
}

export interface ImageMetadata {
    width: number;
    height: number;
    format: string;
    size: number;
    title?: string;
    description?: string;
    author?: string;
    createdAt: number;
    tags?: string[];
}

export interface TokenMetadata {
    tokenId: string;
    mintedAt: number;
    owner: string;
    price?: number;
    isListed: boolean;
    royalties: number; // percentage
    transactionHistory: {
        from: string;
        to: string;
        price: number;
        timestamp: number;
    }[];
}

export interface IndexedImageContent {
    cid: string;
    provider: string;
    timestamp: number;
    metadata: ImageMetadata;
    token?: TokenMetadata;
}

export interface IPFSIndex {
    cid: string;
    metadataCid: string;
    contentType: string;
    title?: string;
    description?: string;
    tags?: string[];
    creator: string;
    timestamp: number;
    size: number;
    isEncrypted: boolean;
    durability: string;
    status: 'pending' | 'stored' | 'pinned' | 'failed';
    pinningStatus: {
        pinned: boolean;
        pinServices?: string[];
        pinnedAt?: number;
    };
    retrievalCount: number;
    lastRetrieved?: number;
    searchableText?: string;
}

// Classes
export class IPFSManager {
    queryIndex(body: any) {
        throw new Error('Method not implemented.');
    }
    private ipfs;
    private connected: boolean = false;

    public isConnected(): boolean {
        return this.connected;
    }

    constructor(config: IPFSConfig) {
        this.ipfs = create({
            host: config.host,
            port: config.port,
            protocol: config.protocol
        });
    }

    public async connect(): Promise<void> {
        try {
          const version = await this.ipfs.version(); // Safely verify connection
          console.log(`✅ Connected to IPFS. Version: ${version.version}`);
          this.connected = true;
        } catch (error: any) {
          console.error('❌ Failed to connect to IPFS:', error);
          this.connected = false;
      
          if (error.code === 'ECONNREFUSED') {
            throw new Error('Network error: IPFS daemon is not running. Please start the IPFS daemon first.');
          } else {
            throw new Error(`Network error: Unable to connect to IPFS node. ${error.message}`);
          }
        }
      }
      
    public async store(content: Buffer): Promise<StorageMetadata> {
        if (!this.connected) {
            try {
                await this.connect();
            } catch (error: any) {
                throw new Error(`IPFS Connection Error: ${error.message}. Please ensure IPFS daemon is running and try again.`);
            }
        }

        try {
            if (!content || content.length === 0) {
                throw new Error('Invalid content: Empty buffer received');
            }

            const result = await this.ipfs.add(content);
            if (!result || !result.cid) {
                throw new Error('Invalid response from IPFS node');
            }

            return {
                cid: result.cid.toString(),
                size: result.size,
                timestamp: Date.now()
            };
        } catch (error: any) {
            console.error('Failed to store content:', error);
            if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
                throw new Error('Network error: Lost connection to IPFS node. Please check if IPFS daemon is still running and try again.');
            } else if (error.message.includes('timeout')) {
                throw new Error('Network error: Request timed out. Please check your network connection and try again.');
            } else if (error.message.includes('Invalid content')) {
                throw new Error(error.message);
            } else {
                throw new Error(`Upload error: ${error.message}. Please try again later or contact support if the issue persists.`);
            }
        }
    }

    public async retrieve(cid: string): Promise<Buffer> {
        if (!this.isConnected) throw new Error('Not connected to IPFS');

        const chunks: Uint8Array[] = [];
        for await (const chunk of this.ipfs.cat(cid)) {
            chunks.push(chunk);
        }

        return Buffer.concat(chunks);
    }

    public async pin(cid: string): Promise<void> {
        if (!this.isConnected) throw new Error('Not connected to IPFS');
        await this.ipfs.pin.add(cid);
    }

    public async unpin(cid: string): Promise<void> {
        if (!this.isConnected) throw new Error('Not connected to IPFS');
        await this.ipfs.pin.rm(cid);
    }

    public async listPinned(): Promise<string[]> {
        if (!this.isConnected) throw new Error('Not connected to IPFS');
        
        const pins: string[] = [];
        for await (const pin of this.ipfs.pin.ls()) {
            pins.push(pin.cid.toString());
        }
        return pins;
    }

    public async getStats(cid: string): Promise<any> {
        if (!this.isConnected) throw new Error('Not connected to IPFS');
        
        const stats = await this.ipfs.files.stat(`/ipfs/${cid}`);
        return {
            size: stats.size,
            blocks: stats.blocks,
            cumulativeSize: stats.cumulativeSize,
            type: stats.type
        };
    }

    public async exists(cid: string): Promise<boolean> {
        try {
            await this.ipfs.files.stat(`/ipfs/${cid}`);
            return true;
        } catch {
            return false;
        }
    }
}

export class IPFSQuery {
    private ipfs: any;

    constructor(ipfsEndpoint: string) {
        this.ipfs = create({ url: ipfsEndpoint });
    }

    async queryByCID(cid: string): Promise<IPFSQueryResult> {
        try {
            const content = await this.ipfs.cat(cid);
            const stats = await this.ipfs.files.stat(`/ipfs/${cid}`);
            
            return {
                cid,
                content,
                metadata: {
                    provider: stats.provider || 'unknown',
                    timestamp: stats.mtime || Date.now(),
                    size: stats.size,
                    type: stats.type
                }
            };
        } catch (error) {
            console.error(`Error querying CID ${cid}:`, error);
            throw error;
        }
    }

    async queryByMetadata(filters: {
        provider?: string;
        fromTimestamp?: number;
        toTimestamp?: number;
        type?: string;
    }): Promise<IPFSQueryResult[]> {
        try {
            const results: IPFSQueryResult[] = [];
            const matchingCIDs = await this.queryIndex(filters);
            for (const cid of matchingCIDs) {
                try {
                    const result = await this.queryByCID(cid);
                    results.push(result);
                } catch (error) {
                    console.error(`Error fetching content for CID ${cid}:`, error);
                }
            }
            return results;
        } catch (error) {
            console.error('Error querying by metadata:', error);
            throw error;
        }
    }

    public async queryIndex(query: any): Promise<any[]> {
        console.log('queryIndex called with:', query);
        // Example return value for now
        return [
            {
                cid: 'bafyExampleCID',
                title: 'Sample Title',
                description: 'Test content',
                creator: '0xCreator',
                timestamp: Date.now(),
                size: 1234,
                contentType: 'text/plain',
                isEncrypted: false,
                durability: 'standard',
                status: 'stored',
                retrievalCount: 1
            }
        ];
    }

    async verifyContent(cid: string, content: any): Promise<boolean> {
        try {
            const retrievedContent = await this.ipfs.cat(cid);
            return JSON.stringify(retrievedContent) === JSON.stringify(content);
        } catch (error) {
            console.error(`Error verifying content for CID ${cid}:`, error);
            return false;
        }
    }

    async getContentStats(cid: string): Promise<{
        size: number;
        type: string;
        links: number;
        blocks: number;
    }> {
        try {
            const stats = await this.ipfs.files.stat(`/ipfs/${cid}`);
            return {
                size: stats.size,
                type: stats.type,
                links: stats.links || 0,
                blocks: stats.blocks || 0
            };
        } catch (error) {
            console.error(`Error getting stats for CID ${cid}:`, error);
            throw error;
        }
    }
}

export class IPFSImageIndexer extends EventEmitter {
    private ipfs: any;
    private mongoClient: MongoClient;
    private imageCollection!: Collection<IndexedImageContent>;
    private contentCollection!: Collection<IPFSIndex>;
    private isIndexing: boolean = false;
    private ipfsService: IPFSManager;

    constructor(ipfsEndpoint: string, mongoUrl: string, ipfsService?: IPFSManager) {
        super();
        this.ipfs = create({ url: ipfsEndpoint });
        this.mongoClient = new MongoClient(mongoUrl);
        this.ipfsService = ipfsService || new IPFSManager({
            host: 'localhost',
            port: 5001,
            protocol: 'http'
        });
    }

    async initialize(): Promise<void> {
        try {
            await this.mongoClient.connect();
            const db = this.mongoClient.db('ipfs_index');
            this.imageCollection = db.collection<IndexedImageContent>('images');
            this.contentCollection = db.collection<IPFSIndex>('content');
            await this.imageCollection.createIndex({ cid: 1 }, { unique: true });
            await this.imageCollection.createIndex({ 'token.tokenId': 1 }, { unique: true, sparse: true });
            await this.imageCollection.createIndex({ 'token.owner': 1 });
            await this.imageCollection.createIndex({ 'token.isListed': 1 });
            await this.imageCollection.createIndex({ 'metadata.tags': 1 });
            await this.imageCollection.createIndex({ 'metadata.createdAt': 1 });
            await this.contentCollection.createIndex({ cid: 1 }, { unique: true });
            await this.contentCollection.createIndex({ metadataCid: 1 });
            await this.contentCollection.createIndex({ contentType: 1 });
            await this.contentCollection.createIndex({ creator: 1 });
            await this.contentCollection.createIndex({ timestamp: -1 });
            await this.contentCollection.createIndex({ retrievalCount: -1 });
            await this.contentCollection.createIndex({ tags: 1 });
            await this.contentCollection.createIndex({ status: 1 });
            await this.contentCollection.createIndex(
                { title: "text", description: "text", searchableText: "text", tags: "text" },
                { 
                    weights: {
                        title: 10,
                        tags: 5,
                        description: 3,
                        searchableText: 1
                    }
                }
            );
            await this.ipfsService.connect();
        } catch (error) {
            console.error('Error initializing MongoDB:', error);
            throw error;
        }
    }

    async indexImage(
        cid: string, 
        imageMetadata: Partial<ImageMetadata>,
        mintToken: boolean = false,
        owner?: string
    ): Promise<void> {
        try {
            const stats = await this.ipfs.files.stat(`/ipfs/${cid}`);
            if (!stats.type.startsWith('image/')) {
                throw new Error('Content is not an image');
            }

            const indexedContent: IndexedImageContent = {
                cid,
                provider: stats.provider || 'unknown',
                timestamp: Date.now(),
                metadata: {
                    width: imageMetadata.width || 0,
                    height: imageMetadata.height || 0,
                    format: stats.type.split('/')[1],
                    size: stats.size,
                    createdAt: Date.now(),
                    ...imageMetadata
                }
            };

            if (mintToken && owner) {
                indexedContent.token = {
                    tokenId: `IMG-${Date.now()}-${cid.slice(0, 8)}`,
                    mintedAt: Date.now(),
                    owner,
                    isListed: false,
                    royalties: 2.5,
                    transactionHistory: [{
                        from: '0x0000000000000000000000000000000000000000',
                        to: owner,
                        price: 0,
                        timestamp: Date.now()
                    }]
                };
            }

            await this.imageCollection.updateOne(
                { cid },
                { $set: indexedContent },
                { upsert: true }
            );

            this.emit('imageIndexed', indexedContent);
            if (mintToken) {
                this.emit('tokenMinted', indexedContent.token);
            }
        } catch (error) {
            console.error(`Error indexing image ${cid}:`, error);
            throw error;
        }
    }

    async listToken(tokenId: string, price: number): Promise<void> {
        try {
            const result = await this.imageCollection.updateOne(
                { 'token.tokenId': tokenId },
                { 
                    $set: { 
                        'token.isListed': true,
                        'token.price': price 
                    }
                }
            );

            if (result.matchedCount === 0) {
                throw new Error('Token not found');
            }

            this.emit('tokenListed', { tokenId, price });
        } catch (error) {
            console.error(`Error listing token ${tokenId}:`, error);
            throw error;
        }
    }

    async transferToken(tokenId: string, from: string, to: string, price: number): Promise<void> {
        try {
            const result = await this.imageCollection.updateOne(
                { 
                    'token.tokenId': tokenId,
                    'token.owner': from
                },
                {
                    $set: {
                        'token.owner': to,
                        'token.isListed': false,
                        'token.price': undefined
                    },
                    $push: {
                        'token.transactionHistory': {
                            from,
                            to,
                            price,
                            timestamp: Date.now()
                        }
                    }
                }
            );

            if (result.matchedCount === 0) {
                throw new Error('Token not found or not owned by sender');
            }

            this.emit('tokenTransferred', {
                tokenId,
                from,
                to,
                price
            });
        } catch (error) {
            console.error(`Error transferring token ${tokenId}:`, error);
            throw error;
        }
    }

    async queryImages(filters: {
        owner?: string;
        isListed?: boolean;
        minPrice?: number;
        maxPrice?: number;
        tags?: string[];
        fromDate?: number;
        toDate?: number;
    }): Promise<IndexedImageContent[]> {
        try {
            const query: any = {};

            if (filters.owner) {
                query['token.owner'] = filters.owner;
            }
            if (typeof filters.isListed === 'boolean') {
                query['token.isListed'] = filters.isListed;
            }
            if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
                query['token.price'] = {};
                if (filters.minPrice !== undefined) {
                    query['token.price'].$gte = filters.minPrice;
                }
                if (filters.maxPrice !== undefined) {
                    query['token.price'].$lte = filters.maxPrice;
                }
            }
            if (filters.tags && filters.tags.length > 0) {
                query['metadata.tags'] = { $all: filters.tags };
            }
            if (filters.fromDate || filters.toDate) {
                query['metadata.createdAt'] = {};
                if (filters.fromDate) {
                    query['metadata.createdAt'].$gte = filters.fromDate;
                }
                if (filters.toDate) {
                    query['metadata.createdAt'].$lte = filters.toDate;
                }
            }

            const results = await this.imageCollection.find(query).toArray();
            return results.map(({ _id, ...content }) => content as IndexedImageContent);
        } catch (error) {
            console.error('Error querying images:', error);
            throw error;
        }
    }

    async getTokenStats(): Promise<{
        totalTokens: number;
        totalListed: number;
        averagePrice: number;
        totalVolume: number;
        topSellers: { owner: string; sales: number }[];
    }> {
        try {
            const [
                totalTokens,
                listedStats,
                volumeStats,
                sellerStats
            ] = await Promise.all([
                this.imageCollection.countDocuments({ token: { $exists: true } }),
                this.imageCollection.aggregate([
                    { $match: { 'token.isListed': true } },
                    { 
                        $group: { 
                            _id: null,
                            count: { $sum: 1 },
                            avgPrice: { $avg: '$token.price' }
                        }
                    }
                ]).toArray(),
                this.imageCollection.aggregate([
                    { $unwind: '$token.transactionHistory' },
                    {
                        $group: {
                            _id: null,
                            totalVolume: { $sum: '$token.transactionHistory.price' }
                        }
                    }
                ]).toArray(),
                this.imageCollection.aggregate([
                    { $unwind: '$token.transactionHistory' },
                    {
                        $group: {
                            _id: '$token.owner',
                            sales: { $sum: 1 }
                        }
                    },
                    { $sort: { sales: -1 } },
                    { $limit: 5 }
                ]).toArray()
            ]);

            const averagePrice = listedStats[0]?.avgPrice || 0;
            const totalListed = listedStats[0]?.count || 0;
            const totalVolume = volumeStats[0]?.totalVolume || 0;
            const topSellers = sellerStats.map(seller => ({ owner: seller._id, sales: seller.sales }));

            return {
                totalTokens,
                totalListed,
                averagePrice,
                totalVolume,
                topSellers
            };
        } catch (error) {
            console.error('Error getting token stats:', error);
            throw error;
        }
    }
}