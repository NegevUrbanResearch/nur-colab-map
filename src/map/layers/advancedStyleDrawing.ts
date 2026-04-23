import type Point from "@mapbox/point-geometry";
import type { AdvancedDrawCommand } from "./advancedStyleEngine";

function num(x: unknown, fallback: number): number {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}

function str(x: unknown, fallback: string): string {
  return typeof x === "string" && x.length > 0 ? x : fallback;
}

function traceGeometryPath(ctx: CanvasRenderingContext2D, geom: Point[][]): void {
  for (const ring of geom) {
    for (let p = 0; p < ring.length; p++) {
      const pt = ring[p];
      if (p === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
  }
}

function placeMarkersAlongPaths(
  geom: Point[][],
  interval: number,
  offsetAlong: number,
  drawAt: (x: number, y: number, angle: number) => void,
): void {
  if (interval <= 0) return;
  for (const ring of geom) {
    let nextMark = offsetAlong;
    let acc = 0;
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1];
      const b = ring[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const segLen = Math.hypot(dx, dy);
      if (segLen === 0) continue;
      const angle = Math.atan2(dy, dx);
      while (nextMark <= acc + segLen) {
        const local = nextMark - acc;
        const ux = dx / segLen;
        const uy = dy / segLen;
        drawAt(a.x + ux * local, a.y + uy * local, angle);
        nextMark += interval;
      }
      acc += segLen;
    }
  }
}

function drawLineMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  shape: string,
  size: number,
  strokeColor: string,
  strokeWidth: number,
  fillColor: string | null,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = strokeColor;
  if (fillColor) ctx.fillStyle = fillColor;
  const half = size / 2;
  ctx.beginPath();
  if (shape === "square" || shape === "rectangle") {
    ctx.rect(-half, -half, size, size);
  } else {
    ctx.arc(0, 0, half, 0, Math.PI * 2);
  }
  if (fillColor) ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Executes Cityscope-ordered paint commands on tile-space geometry (canvas pixels).
 */
export function executeAdvancedDrawCommands(
  ctx: CanvasRenderingContext2D,
  geom: Point[][],
  commands: AdvancedDrawCommand[],
  geometryHint: "line" | "polygon",
): void {
  if (geom.length === 0) return;

  for (const cmd of commands) {
    if (cmd.kind === "fill" && geometryHint === "polygon") {
      ctx.save();
      ctx.globalAlpha = cmd.opacity;
      ctx.fillStyle = cmd.color;
      ctx.beginPath();
      traceGeometryPath(ctx, geom);
      ctx.fill();
      ctx.restore();
    } else if (cmd.kind === "stroke") {
      ctx.save();
      ctx.globalAlpha = cmd.opacity;
      ctx.strokeStyle = cmd.color;
      ctx.lineWidth = cmd.width;
      ctx.lineCap = "butt";
      ctx.lineJoin = "miter";
      if (cmd.dash && cmd.dash.length > 0) ctx.setLineDash(cmd.dash);
      else ctx.setLineDash([]);
      ctx.beginPath();
      traceGeometryPath(ctx, geom);
      ctx.stroke();
      ctx.restore();
    } else if (cmd.kind === "markerLine") {
      const placement = cmd.placement;
      const interval = num(placement.interval, 15);
      const offsetAlong = num(placement.offsetAlong, 0);
      const marker = cmd.marker;
      const shape = str(marker.shape, "circle");
      const size = num(marker.size, 6);
      const strokeColor = str(marker.strokeColor, "#000000");
      const strokeWidth = num(marker.strokeWidth, 1);
      const fillRaw = marker.fillColor;
      const fillColor =
        typeof fillRaw === "string" && fillRaw.length > 0 ? fillRaw : null;
      placeMarkersAlongPaths(geom, interval, offsetAlong, (x, y, angle) => {
        drawLineMarker(ctx, x, y, angle, shape, size, strokeColor, strokeWidth, fillColor);
      });
    }
  }
}
