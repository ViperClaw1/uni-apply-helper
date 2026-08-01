/** Normalize profile.documents entry to an ordered URL list. */
export declare function getDocumentUrls(documents: Record<string, string | string[]> | undefined, type: string): string[];
export declare function hasDocument(documents: Record<string, string | string[]> | undefined, type: string): boolean;
type DocumentLike = {
    type: string;
    fileUrl: string;
    sortOrder?: number | null;
    uploadedAt?: Date | string | null;
};
/** Group DB rows into profile.documents (single URL or ordered array). */
export declare function groupDocumentUrls(documents: DocumentLike[]): Record<string, string | string[]>;
export {};
