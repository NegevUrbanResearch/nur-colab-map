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
  /** Point marker shape from Cityscope */
  pointShape?: "circle" | "square" | "diamond" | "cross" | "x";
  /** Approximate point symbol radius hint (px) for legend sizing */
  pointSizePx?: number;
};

export type LegendModelRow = {
  id: string;
  label: string;
  detail?: string;
  swatch?: LegendSwatchPreview;
};

export type LegendModelGroup = {
  packId: string;
  packName: string;
  rows: LegendModelRow[];
};

export type LegendModel = {
  groups: LegendModelGroup[];
};
