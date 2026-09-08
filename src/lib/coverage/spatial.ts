import type { Point } from "./types";

type Node = {
  index: number;
  axis: 0 | 1;
  left: Node | null;
  right: Node | null;
};

/** Exact balanced kd-tree. Equal distances keep the original, lowest site index. */
export class SiteIndex {
  private root: Node | null;
  constructor(private sites: readonly Point[]) {
    const build = (ids: number[], depth: number): Node | null => {
      if (!ids.length) return null;
      const axis = (depth % 2) as 0 | 1;
      const key = axis === 0 ? "x" : "y";
      ids.sort((a, b) => sites[a][key] - sites[b][key] || a - b);
      const mid = ids.length >> 1;
      return {
        index: ids[mid],
        axis,
        left: build(ids.slice(0, mid), depth + 1),
        right: build(ids.slice(mid + 1), depth + 1),
      };
    };
    this.root = build(
      sites.map((_, i) => i),
      0,
    );
  }

  nearest(x: number, y: number): number {
    let best = -1,
      distance = Infinity;
    const visit = (node: Node | null) => {
      if (!node) return;
      const p = this.sites[node.index];
      const dx = x - p.x,
        dy = y - p.y;
      const d = dx * dx + dy * dy;
      if (d < distance || (d === distance && (best < 0 || node.index < best))) {
        best = node.index;
        distance = d;
      }
      const delta = node.axis === 0 ? dx : dy;
      visit(delta <= 0 ? node.left : node.right);
      if (delta * delta <= distance) visit(delta <= 0 ? node.right : node.left);
    };
    visit(this.root);
    return best;
  }
}
