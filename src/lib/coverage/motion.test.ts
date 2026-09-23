import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import {
  frameIndex,
  motionModels,
  parseMotionClip,
  spriteStyle,
} from "./motion";
describe("conference motion clips", () => {
  for (const model of motionModels)
    it(`${model.id}: starts in motion and exposes only presentation data`, () => {
      const data = JSON.parse(
        readFileSync(`public/motion/${model.id}.json`, "utf8"),
      );
      expect(Object.keys(data).sort()).toEqual(
        [
          "version",
          "kind",
          "width",
          "height",
          "agents",
          "fps",
          "duration",
          "settleDuration",
          "atlas",
          "frames",
        ].sort(),
      );
      const clip = parseMotionClip(data, model.id);
      expect(clip.settleDuration).toBe(0);
      expect(clip.frames[0].phase).toBe(0);
      expect(clip.frames[1].phase).toBeGreaterThan(0);
      expect(clip.frames.at(-1)!.phase).toBeCloseTo(4 * Math.PI, 5);
      for (const f of data.frames)
        expect(Object.keys(f).sort()).toEqual(
          ["time", "phase", "positions", "meanDistance"].sort(),
        );
      expect(clip.frames[24].positions).not.toEqual(clip.frames[0].positions);
      expect(clip.frames[48].meanDistance).toBeLessThan(
        clip.frames[0].meanDistance,
      );
      for (const layer of ["input", "edge"] as const)
        expect(
          statSync(`public/motion/${model.id}-${layer}.webp`).size,
        ).toBeGreaterThan(1000);
      expect(frameIndex(-1, clip)).toBe(0);
      expect(frameIndex(100, clip)).toBe(576);
      expect(spriteStyle(model.id, "input", 0).backgroundPosition).toBe(
        "0% 0%",
      );
      expect(spriteStyle(model.id, "input", 576).backgroundPosition).toBe(
        "0% 100%",
      );
      const broken = structuredClone(data);
      broken.frames[10].positions[0][0] = null;
      expect(() => parseMotionClip(broken, model.id)).toThrow();
      expect(() =>
        parseMotionClip({ ...data, settleDuration: 4 }, model.id),
      ).toThrow();
      expect(() =>
        parseMotionClip({ ...data, frames: data.frames.slice(1) }, model.id),
      ).toThrow();
    });
});
