import { SearchFilters } from './types';
export function validateSearchQuery(filters: SearchFilters): string | null {
    // Validate page and limit
    if (filters.page < 1) {
        return 'Page number must be greater than 0';
    }
    if (filters.limit < 1 || filters.limit > 100) {
        return 'Limit must be between 1 and 100';
    }

    // Validate date range if provided
    if (filters.fromDate && filters.toDate) {
        if (filters.fromDate > filters.toDate) {
            return 'From date must be before to date';
        }
    }

    // Validate content type if provided
    if (filters.contentType && 
        !['file', 'image', 'video', 'dna'].includes(filters.contentType)) {
        return 'Invalid content type';
    }

    // Validate creator address if provided
    if (filters.creator && !/^0x[a-fA-F0-9]{40}$/.test(filters.creator)) {
        return 'Invalid creator address format';
    }

    // Validate status if provided
    if (filters.status && 
        !['pending', 'approved', 'rejected'].includes(filters.status)) {
        return 'Invalid status';
    }

    return null;
} 