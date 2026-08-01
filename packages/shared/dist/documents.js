"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDocumentUrls = getDocumentUrls;
exports.hasDocument = hasDocument;
exports.groupDocumentUrls = groupDocumentUrls;
/** Normalize profile.documents entry to an ordered URL list. */
function getDocumentUrls(documents, type) {
    const value = documents?.[type];
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value.filter((url) => typeof url === 'string' && url.trim());
    }
    return value.trim() ? [value] : [];
}
function hasDocument(documents, type) {
    return getDocumentUrls(documents, type).length > 0;
}
/** Group DB rows into profile.documents (single URL or ordered array). */
function groupDocumentUrls(documents) {
    const sorted = [...documents].sort((left, right) => {
        const orderDiff = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
        if (orderDiff !== 0) {
            return orderDiff;
        }
        const leftTime = left.uploadedAt
            ? new Date(left.uploadedAt).getTime()
            : 0;
        const rightTime = right.uploadedAt
            ? new Date(right.uploadedAt).getTime()
            : 0;
        return leftTime - rightTime;
    });
    const byType = new Map();
    for (const document of sorted) {
        const list = byType.get(document.type) ?? [];
        list.push(document.fileUrl);
        byType.set(document.type, list);
    }
    const out = {};
    for (const [type, urls] of byType) {
        out[type] = urls.length === 1 ? urls[0] : urls;
    }
    return out;
}
