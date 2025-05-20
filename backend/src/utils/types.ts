export interface SearchFilters {
    query?: string;
    tags?: string[];
    status?: string;
    creator?: string;
    contentType?: string;
    fromDate?: Date;
    toDate?: Date;
    page: number;
    limit: number;
}

export interface SearchResponseItem {
    contentId: string;
    title: string;
    description: string;
    creator: string;
    ipfsCid: string;
    contentType: string;
    tags: string[];
    status: string;
    createdAt: Date;
    transactionHash: string;
}

export interface SearchResponse {
    items: SearchResponseItem[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
    };
} 