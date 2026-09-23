import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { frameIndex, motionModels, parseMotionClip } from "./motion";

describe("public motion clips", () => {
  for (const model of motionModels) {
    it(`${model.id}: validates complete synchronized trajectories with no private fields`, () => {
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
          "frames",
        ].sort(),
      );
      const clip = parseMotionClip(data, model.id);
      for (const f of data.frames)
        expect(Object.keys(f).sort()).toEqual(
          ["time", "phase", "paths", "positions", "meanDistance"].sort(),
        );
      expect(clip.frames[0].time).toBe(0);
      expect(clip.frames.at(-1)!.time).toBe(clip.duration);
      const at = (t: number) => clip.frames[frameIndex(t, clip)];
      expect(at(4).paths).toEqual(at(14).paths);
      expect(at(14).paths).toEqual(at(24).paths);
      expect(at(4).paths).not.toEqual(at(6.5).paths);
      expect(at(4).positions).not.toEqual(at(6.5).positions);
      expect(at(4).meanDistance).toBeLessThan(clip.frames[0].meanDistance);
      expect(frameIndex(-1, clip)).toBe(0);
      expect(frameIndex(100, clip)).toBe(clip.frames.length - 1);
      if (model.id === "windmill") {
        for (const f of clip.frames)
          expect(f.paths.slice(0, 2)).toEqual(at(4).paths.slice(0, 2));
      }
      const malformed = structuredClone(data);
      malformed.frames[20].positions[0][0] = null;
      expect(() => parseMotionClip(malformed, model.id)).toThrow();
      expect(() =>
        parseMotionClip({ ...data, frames: data.frames.slice(1) }, model.id),
      ).toThrow();
      expect(() =>
        parseMotionClip({ ...data, kind: "unknown" }, model.id),
      ).toThrow();
    });
  }
});
