/** 2次元平面上の点 */
export type Point = { x: number; y: number };

/**
 * 重要度関数Φを離散化したもの。
 * phi は行優先（row-major）で width * height 個の重みを持ち、
 * インデックス i のセルは (x, y) = (i % width, floor(i / width)) に対応する。
 */
export type PhiGrid = {
  width: number;
  height: number;
  phi: number[];
};
