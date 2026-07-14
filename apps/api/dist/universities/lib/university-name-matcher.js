"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeUniversityName = normalizeUniversityName;
exports.matchUniversityName = matchUniversityName;
const AUTO_MATCH_THRESHOLD = 0.86;
const CANDIDATE_THRESHOLD = 0.55;
function normalizeUniversityName(value) {
    return value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\buniversity of\b/g, 'university')
        .replace(/\bthe\b/g, ' ')
        .replace(/\buniv\.?\b/g, 'university')
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function matchUniversityName(rawName, entries) {
    const normalizedRaw = normalizeUniversityName(rawName);
    if (!normalizedRaw) {
        return { universityId: null, candidates: [] };
    }
    const scored = entries
        .map((entry) => ({
        id: entry.id,
        displayName: entry.displayName,
        score: scoreUniversityEntry(normalizedRaw, entry),
    }))
        .filter((candidate) => candidate.score >= CANDIDATE_THRESHOLD)
        .sort((left, right) => right.score - left.score);
    const bestMatch = scored[0];
    return {
        universityId: bestMatch && bestMatch.score >= AUTO_MATCH_THRESHOLD ? bestMatch.id : null,
        candidates: scored.slice(0, 5),
    };
}
function scoreUniversityEntry(normalizedRaw, entry) {
    const variants = new Set([
        normalizeUniversityName(entry.displayName),
        normalizeUniversityName(entry.id.replace(/-/g, ' ')),
        ...entry.aliases.map((alias) => normalizeUniversityName(alias)),
    ]);
    let bestScore = 0;
    for (const variant of variants) {
        if (!variant) {
            continue;
        }
        if (variant === normalizedRaw) {
            return 1;
        }
        if (variant.includes(normalizedRaw) || normalizedRaw.includes(variant)) {
            bestScore = Math.max(bestScore, 0.92);
            continue;
        }
        bestScore = Math.max(bestScore, stringSimilarity(normalizedRaw, variant));
    }
    return bestScore;
}
function stringSimilarity(left, right) {
    if (!left || !right) {
        return 0;
    }
    const distance = levenshteinDistance(left, right);
    return 1 - distance / Math.max(left.length, right.length);
}
function levenshteinDistance(left, right) {
    const matrix = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
    for (let row = 0; row <= left.length; row += 1) {
        matrix[row][0] = row;
    }
    for (let column = 0; column <= right.length; column += 1) {
        matrix[0][column] = column;
    }
    for (let row = 1; row <= left.length; row += 1) {
        for (let column = 1; column <= right.length; column += 1) {
            const cost = left[row - 1] === right[column - 1] ? 0 : 1;
            matrix[row][column] = Math.min(matrix[row - 1][column] + 1, matrix[row][column - 1] + 1, matrix[row - 1][column - 1] + cost);
        }
    }
    return matrix[left.length][right.length];
}
//# sourceMappingURL=university-name-matcher.js.map