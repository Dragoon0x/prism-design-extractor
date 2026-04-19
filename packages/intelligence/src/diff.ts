/**
 * Diff two canonical extractions — A (older) vs B (newer).
 *
 * Stable token ids from `@prism/tokens/hash` mean same-value tokens across
 * extractions share an id. So a diff reduces to set operations on ids plus
 * per-id comparisons of confidence / usage / semanticRole.
 *
 * The diff is the data backend for the `Diff` tab that lands in Phase 11.
 */
import type { CanonicalExtraction, Token, TokenCategory } from '@prism/shared';

export interface TokenDiffEntry {
  tokenId: string;
  category: TokenCategory;
  name: string;
  usageA?: number;
  usageB?: number;
  confidenceA?: number;
  confidenceB?: number;
  semanticRoleA?: string;
  semanticRoleB?: string;
}

export interface CanonicalDiff {
  addedTokens: TokenDiffEntry[];
  removedTokens: TokenDiffEntry[];
  changedTokens: TokenDiffEntry[];
  unchangedCount: number;
  summary: {
    addedCount: number;
    removedCount: number;
    changedCount: number;
    unchangedCount: number;
    /** Net total change across the extraction. */
    netChange: number;
  };
}

function indexById(tokens: Token[]): Map<string, Token> {
  const map = new Map<string, Token>();
  for (const t of tokens) map.set(t.id, t);
  return map;
}

function entryFrom(token: Token, side: 'A' | 'B'): TokenDiffEntry {
  const base: TokenDiffEntry = {
    tokenId: token.id,
    category: token.category,
    name: token.name,
  };
  if (side === 'A') {
    base.usageA = token.usageCount;
    base.confidenceA = token.confidence;
    if (token.semanticRole) base.semanticRoleA = token.semanticRole;
  } else {
    base.usageB = token.usageCount;
    base.confidenceB = token.confidence;
    if (token.semanticRole) base.semanticRoleB = token.semanticRole;
  }
  return base;
}

function mergeEntry(
  fromA: Token,
  fromB: Token,
): TokenDiffEntry {
  return {
    tokenId: fromB.id,
    category: fromB.category,
    name: fromB.name,
    usageA: fromA.usageCount,
    usageB: fromB.usageCount,
    confidenceA: fromA.confidence,
    confidenceB: fromB.confidence,
    ...(fromA.semanticRole ? { semanticRoleA: fromA.semanticRole } : {}),
    ...(fromB.semanticRole ? { semanticRoleB: fromB.semanticRole } : {}),
  };
}

function tokenChanged(a: Token, b: Token): boolean {
  if (a.confidence.toFixed(2) !== b.confidence.toFixed(2)) return true;
  if (a.usageCount !== b.usageCount) return true;
  if ((a.semanticRole ?? '') !== (b.semanticRole ?? '')) return true;
  if (a.name !== b.name) return true;
  return false;
}

export function diffCanonicals(a: CanonicalExtraction, b: CanonicalExtraction): CanonicalDiff {
  const aIndex = indexById(a.tokens);
  const bIndex = indexById(b.tokens);

  const added: TokenDiffEntry[] = [];
  const removed: TokenDiffEntry[] = [];
  const changed: TokenDiffEntry[] = [];
  let unchangedCount = 0;

  for (const [id, bToken] of bIndex) {
    const aToken = aIndex.get(id);
    if (!aToken) {
      added.push(entryFrom(bToken, 'B'));
      continue;
    }
    if (tokenChanged(aToken, bToken)) {
      changed.push(mergeEntry(aToken, bToken));
    } else {
      unchangedCount++;
    }
  }
  for (const [id, aToken] of aIndex) {
    if (!bIndex.has(id)) removed.push(entryFrom(aToken, 'A'));
  }

  return {
    addedTokens: added,
    removedTokens: removed,
    changedTokens: changed,
    unchangedCount,
    summary: {
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length,
      unchangedCount,
      netChange: added.length - removed.length,
    },
  };
}
