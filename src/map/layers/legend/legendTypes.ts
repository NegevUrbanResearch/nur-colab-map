export type LegendSwatchKind = "point" | "line" | "polygon";

export type LegendSwatchPreview = {
  kind: LegendSwatchKind;
  /** Point: fill; polygon: fill */
  fillColor?: string;
  fillOpacity?: number;
  /** Point / line / polygon outline */
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  /** Line: SVG/Leaflet dash pattern (e.g. `4 2`) when the pack stroke uses dashes */
  strokeDasharray?: string;
  /** Point marker shape from Cityscope */
  pointShape?: "circle" | "square" | "diamond" | "cross" | "x";
  /** Approximate point symbol radius hint (px) for legend sizing */
  pointSizePx?: number;
};

export type LegendModelRow = {
  id: string;
  label: string;
  detail?: string;
  /** Single preview; kept for backward compatibility. Prefer `swatches` when multiple geometries apply. */
  swatch?: LegendSwatchPreview;
  /** Inline previews for combined (multi-geometry) legend rows, e.g. October 7 families. */
  swatches?: LegendSwatchPreview[];
};

export type LegendModelGroup = {
  packId: string;
  packName: string;
  rows: LegendModelRow[];
};

export type LegendModel = {
  groups: LegendModelGroup[];
};
