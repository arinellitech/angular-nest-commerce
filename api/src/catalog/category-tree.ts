/**
 * Products are attached to leaf categories, but shoppers browse by any level:
 * filtering by "Eletrônicos" must include "Teclados", and its product count
 * must include its children's.
 */
export interface CategoryNode {
  id: number;
  parentId: number | null;
}

/** The category itself plus every descendant, at any depth. */
export function withDescendants<T extends CategoryNode>(
  categories: T[],
  rootId: number,
): T[] {
  const root = categories.find((c) => c.id === rootId);
  if (!root) return [];

  const result = [root];
  const seen = new Set([rootId]);
  for (let i = 0; i < result.length; i++) {
    for (const child of categories) {
      if (child.parentId === result[i]!.id && !seen.has(child.id)) {
        seen.add(child.id);
        result.push(child);
      }
    }
  }
  return result;
}

/** Direct counts per category → counts including all descendants. */
export function rollUpCounts(
  categories: CategoryNode[],
  directCounts: Map<number, number>,
): Map<number, number> {
  return new Map(
    categories.map((category) => [
      category.id,
      withDescendants(categories, category.id).reduce(
        (sum, c) => sum + (directCounts.get(c.id) ?? 0),
        0,
      ),
    ]),
  );
}
