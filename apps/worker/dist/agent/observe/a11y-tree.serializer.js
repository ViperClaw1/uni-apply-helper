"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeAccessibilityTree = serializeAccessibilityTree;
const SKIP_ROLES = new Set(['none', 'presentation', 'generic']);
function serializeAccessibilityTree(node, depth = 0, maxDepth = 6) {
    if (!node || depth > maxDepth) {
        return '';
    }
    const role = node.role ?? 'unknown';
    if (SKIP_ROLES.has(role) && !node.name && !node.value) {
        return (node.children ?? [])
            .map((child) => serializeAccessibilityTree(child, depth, maxDepth))
            .filter(Boolean)
            .join('\n');
    }
    const indent = '  '.repeat(depth);
    const parts = [`${indent}[${role}]`];
    if (node.name) {
        parts.push(`name="${truncate(node.name, 120)}"`);
    }
    if (node.value) {
        parts.push(`value="${truncate(node.value, 80)}"`);
    }
    if (node.description) {
        parts.push(`desc="${truncate(node.description, 80)}"`);
    }
    const line = parts.join(' ');
    const children = (node.children ?? [])
        .map((child) => serializeAccessibilityTree(child, depth + 1, maxDepth))
        .filter(Boolean)
        .join('\n');
    return children ? `${line}\n${children}` : line;
}
function truncate(value, maxLength) {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length <= maxLength
        ? normalized
        : `${normalized.slice(0, maxLength)}…`;
}
//# sourceMappingURL=a11y-tree.serializer.js.map