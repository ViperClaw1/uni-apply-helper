/** Normalize profile.documents entry to an ordered URL list. */
export function getDocumentUrls(
  documents: Record<string, string | string[]> | undefined,
  type: string,
): string[] {
  const value = documents?.[type];
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter((url) => typeof url === 'string' && url.trim());
  }
  return value.trim() ? [value] : [];
}

export function hasDocument(
  documents: Record<string, string | string[]> | undefined,
  type: string,
): boolean {
  return getDocumentUrls(documents, type).length > 0;
}

type DocumentLike = {
  type: string;
  fileUrl: string;
  sortOrder?: number | null;
  uploadedAt?: Date | string | null;
};

/** Group DB rows into profile.documents (single URL or ordered array). */
export function groupDocumentUrls(
  documents: DocumentLike[],
): Record<string, string | string[]> {
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

  const byType = new Map<string, string[]>();
  for (const document of sorted) {
    const list = byType.get(document.type) ?? [];
    list.push(document.fileUrl);
    byType.set(document.type, list);
  }

  const out: Record<string, string | string[]> = {};
  for (const [type, urls] of byType) {
    out[type] = urls.length === 1 ? urls[0]! : urls;
  }
  return out;
}
