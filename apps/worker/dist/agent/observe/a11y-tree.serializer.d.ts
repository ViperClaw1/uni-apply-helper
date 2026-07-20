type AccessibilityNode = {
    role?: string;
    name?: string;
    value?: string;
    description?: string;
    children?: AccessibilityNode[];
};
export declare function serializeAccessibilityTree(node: AccessibilityNode | null, depth?: number, maxDepth?: number): string;
export {};
