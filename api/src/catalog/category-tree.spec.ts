import { rollUpCounts, withDescendants } from './category-tree.js';

// eletronicos(1) ─┬─ perifericos(2) ─┬─ teclados(4)
//                 │                  └─ mouses(5)
//                 └─ monitores(3)
// casa(6)
const tree = [
  { id: 1, parentId: null },
  { id: 2, parentId: 1 },
  { id: 3, parentId: 1 },
  { id: 4, parentId: 2 },
  { id: 5, parentId: 2 },
  { id: 6, parentId: null },
];

describe('withDescendants', () => {
  it('returns the category and all descendants at any depth', () => {
    expect(withDescendants(tree, 1).map((c) => c.id)).toEqual([1, 2, 3, 4, 5]);
    expect(withDescendants(tree, 2).map((c) => c.id)).toEqual([2, 4, 5]);
    expect(withDescendants(tree, 6).map((c) => c.id)).toEqual([6]);
  });

  it('returns nothing for an unknown category', () => {
    expect(withDescendants(tree, 99)).toEqual([]);
  });
});

describe('rollUpCounts', () => {
  it('adds descendant counts to every ancestor', () => {
    const counts = rollUpCounts(
      tree,
      new Map([
        [4, 6],
        [5, 2],
        [3, 1],
      ]),
    );
    expect(Object.fromEntries(counts)).toEqual({
      1: 9,
      2: 8,
      3: 1,
      4: 6,
      5: 2,
      6: 0,
    });
  });
});
