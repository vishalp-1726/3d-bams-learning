/**
 * Canonical form of a mesh name, matching three.js's
 * PropertyBinding.sanitizeNodeName. See canonical-name.mjs for why this exists.
 */
export declare function canonicalMeshName(name: string): string;

/** Strip a trailing side marker (".r", ".r.", ".r2", ".l") and surrounding space. */
export declare function sidelessMeshName(name: string): string;

/** Reduce to the underlying structure: drops side, "origin/insertion" and "muscle". */
export declare function normalisedMeshName(name: string): string;
