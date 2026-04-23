import { describe, expect, it } from "vitest";
import { buildOrderedDrawCommandsForSymbol } from "./advancedStyleEngine";

describe("buildOrderedDrawCommandsForSymbol", () => {
  it("orders line multi-strokes: non-dashed before dashed, wider before narrower (סינגלים parity)", () => {
    const symbol = {
      symbolLayers: [
        {
          type: "stroke",
          color: "#abdbe3",
          width: 1.02,
          opacity: 1,
          dash: { array: [1.47, 1.47] },
        },
        {
          type: "stroke",
          color: "#704589",
          width: 1.33,
          opacity: 1,
          dash: null,
        },
      ],
    };
    const cmds = buildOrderedDrawCommandsForSymbol(symbol, "line");
    expect(cmds.map((c) => (c.kind === "stroke" ? { kind: c.kind, color: c.color, width: c.width, dash: c.dash } : c))).toEqual([
      { kind: "stroke", color: "#704589", width: 1.33, dash: undefined },
      { kind: "stroke", color: "#abdbe3", width: 1.02, dash: [1.47, 1.47] },
    ]);
  });

  it("within solid-only line strokes, draws wider stroke first", () => {
    const symbol = {
      symbolLayers: [
        { type: "stroke", color: "#aaa", width: 1, opacity: 1, dash: null },
        { type: "stroke", color: "#bbb", width: 4, opacity: 1, dash: null },
      ],
    };
    const cmds = buildOrderedDrawCommandsForSymbol(symbol, "line");
    expect(cmds.map((c) => (c.kind === "stroke" ? c.width : null)).filter((w) => w != null)).toEqual([4, 1]);
  });

  it("within dashed-only line strokes, draws wider stroke first", () => {
    const symbol = {
      symbolLayers: [
        { type: "stroke", color: "#a", width: 1, opacity: 1, dash: [2, 2] },
        { type: "stroke", color: "#b", width: 3, opacity: 1, dash: [4, 4] },
      ],
    };
    const cmds = buildOrderedDrawCommandsForSymbol(symbol, "line");
    expect(cmds.map((c) => (c.kind === "stroke" ? c.width : null)).filter((w) => w != null)).toEqual([3, 1]);
  });

  it("keeps polygon stroke order in source order (no Cityscope line sort)", () => {
    const symbol = {
      symbolLayers: [
        {
          type: "stroke",
          color: "#abdbe3",
          width: 1.02,
          opacity: 1,
          dash: { array: [1.47, 1.47] },
        },
        { type: "stroke", color: "#704589", width: 1.33, opacity: 1, dash: null },
      ],
    };
    const cmds = buildOrderedDrawCommandsForSymbol(symbol, "polygon");
    expect(cmds.map((c) => (c.kind === "stroke" ? c.color : null)).filter(Boolean)).toEqual(["#abdbe3", "#704589"]);
  });

  it("flushes strokes before markerLine so markerLine is not sandwiched inside a reordered stroke batch", () => {
    const symbol = {
      symbolLayers: [
        { type: "stroke", color: "#dashed", width: 2, opacity: 1, dash: [3, 3] },
        {
          type: "markerLine",
          marker: { shape: "circle", size: 4, strokeColor: "#000", strokeWidth: 1 },
          placement: { interval: 10, offsetAlong: 0 },
        },
        { type: "stroke", color: "#solid", width: 5, opacity: 1, dash: null },
      ],
    };
    const cmds = buildOrderedDrawCommandsForSymbol(symbol, "line");
    expect(cmds.map((c) => c.kind)).toEqual(["stroke", "markerLine", "stroke"]);
    const firstStroke = cmds[0];
    const lastStroke = cmds[2];
    expect(firstStroke?.kind).toBe("stroke");
    expect(lastStroke?.kind).toBe("stroke");
    if (firstStroke?.kind === "stroke" && lastStroke?.kind === "stroke") {
      expect(firstStroke.color).toBe("#dashed");
      expect(lastStroke.color).toBe("#solid");
    }
  });
});
