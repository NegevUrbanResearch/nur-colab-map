import type { Feature } from "protomaps-leaflet";
import { normalizedStrokeDashFromEntry } from "./cityscopeSymbolParse";
import { resolveStyleForFeature } from "./cityscopeStyleResolver";
import { packLineStrokePaintFromParsed, packPolygonOutlineWidthFromParsed } from "./styleToLeaflet";
import type { ParsedStroke } from "./cityscopeSymbolParse";

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object";
}

function recordFromNested(v: unknown): Record<string, unknown> {
  if (!isRecord(v)) return {};
  return { ...v };
}

/**
 * Merges feature attributes the way Cityscope / MVT payloads often nest them:
 * `tags` / nested `props` / nested `properties`, then top-level `feature.props` wins on key clashes.
 */
export function mergeFeatureProperties(feature: Feature): Record<string, unknown> {
  const p = feature.props as Record<string, unknown>;
  return {
    ...recordFromNested(p.tags),
    ...recordFromNested(p.props),
    ...recordFromNested(p.properties),
    ...p,
  };
}

export function shouldUseAdvancedPmtilesPath(style: unknown): boolean {
  if (isRecord(style) && style.renderer === "uniqueValue") return true;
  const resolved = resolveStyleForFeature(style, {});
  if (resolved.strokeLayers.length > 1) return true;
  if (resolved.markerLineLayer) return true;
  if (resolved.strokeLayers.some((s) => s.dash != null && s.dash.length > 0)) return true;
  return false;
}

export type AdvancedDrawCommand =
  | { kind: "fill"; color: string; opacity: number }
  | { kind: "stroke"; color: string; width: number; opacity: number; dash?: number[] }
  | { kind: "markerLine"; marker: Record<string, unknown>; placement: Record<string, unknown> };

function num(x: unknown, fallback: number): number {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}

function str(x: unknown, fallback: string): string {
  return typeof x === "string" && x.length > 0 ? x : fallback;
}

function normalizeStrokeForGeometry(
  color: string,
  width: number,
  opacity: number,
  dash: number[] | undefined,
  geometryHint: "line" | "polygon",
): { color: string; width: number; opacity: number; dash: number[] | undefined } {
  const parsed: ParsedStroke = {
    color,
    width,
    opacity,
    dash: dash ?? null,
  };
  if (geometryHint === "line") {
    const p = packLineStrokePaintFromParsed(parsed, { color, weight: width, opacity });
    return { color: p.color, width: p.weight, opacity: p.opacity, dash: p.dash };
  }
  const w = packPolygonOutlineWidthFromParsed(parsed);
  return { color, width: w, opacity, dash };
}

function strokeCommandFromEntry(
  entry: Record<string, unknown>,
  geometryHint: "line" | "polygon",
): AdvancedDrawCommand {
  const dashNull = normalizedStrokeDashFromEntry(entry);
  const dash = dashNull && dashNull.length > 0 ? dashNull : undefined;
  const color = str(entry.color, "#3388ff");
  const width = num(entry.width, 1);
  const opacity = num(entry.opacity, 1);
  const norm = normalizeStrokeForGeometry(color, width, opacity, dash, geometryHint);
  return {
    kind: "stroke",
    color: norm.color,
    width: norm.width,
    opacity: norm.opacity,
    ...(norm.dash != null && norm.dash.length > 0 ? { dash: norm.dash } : {}),
  };
}

/** Cityscope line stacking: solid strokes under dashed; wider strokes under narrower within each group. */
function compareLineStrokeEntriesCityscope(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const dashA = normalizedStrokeDashFromEntry(a);
  const dashB = normalizedStrokeDashFromEntry(b);
  const dashedA = dashA && dashA.length > 0 ? 1 : 0;
  const dashedB = dashB && dashB.length > 0 ? 1 : 0;
  if (dashedA !== dashedB) return dashedA - dashedB;
  return num(b.width, 1) - num(a.width, 1);
}

/**
 * Walks `symbolLayers`, batching consecutive stroke layers so line geometry can reorder multi-strokes
 * like Cityscope (non-dashed before dashed; wider before narrower). Fills and marker lines flush
 * pending strokes first; polygon strokes keep source order within each batch.
 */
export function buildOrderedDrawCommandsForSymbol(
  symbol: unknown,
  geometryHint: "line" | "polygon",
): AdvancedDrawCommand[] {
  if (!isRecord(symbol)) return [];

  const layersRaw = symbol.symbolLayers;
  if (!Array.isArray(layersRaw)) return [];

  const out: AdvancedDrawCommand[] = [];
  const strokeBatch: Record<string, unknown>[] = [];

  const flushStrokes = () => {
    if (strokeBatch.length === 0) return;
    const ordered =
      geometryHint === "line"
        ? [...strokeBatch].sort(compareLineStrokeEntriesCityscope)
        : strokeBatch;
    for (const e of ordered) {
      out.push(strokeCommandFromEntry(e, geometryHint));
    }
    strokeBatch.length = 0;
  };

  for (const entry of layersRaw) {
    if (!isRecord(entry)) continue;
    const t = entry.type;

    if (t === "fill" && entry.fillType === "solid" && geometryHint === "polygon") {
      flushStrokes();
      out.push({
        kind: "fill",
        color: str(entry.color, "#808080"),
        opacity: num(entry.opacity, 0.7),
      });
    } else if (t === "stroke") {
      strokeBatch.push(entry);
    } else if (t === "markerLine" && isRecord(entry.marker)) {
      flushStrokes();
      out.push({
        kind: "markerLine",
        marker: { ...entry.marker },
        placement: isRecord(entry.placement) ? { ...entry.placement } : {},
      });
    }
  }

  flushStrokes();
  return out;
}
