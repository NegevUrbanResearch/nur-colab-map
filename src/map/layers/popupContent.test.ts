import { describe, expect, it } from "vitest";
import type { Feature } from "geojson";
import {
  buildLayerPopupPayload,
  pickPropertiesFromPmtilesDebugPick,
  renderLayerPopupHtml,
} from "./popupModel";
import { popupContentFromUi } from "./popupContent";

describe("popupContentFromUi", () => {
  it("renders rtl popup with human-readable labels", () => {
    const ui = {
      popup: {
        fields: [{ key: "name", label: "name" }],
      },
    };
    const feature: Feature = {
      type: "Feature",
      properties: { name: "Test" },
      geometry: { type: "Point", coordinates: [0, 0] },
    };
    const html = popupContentFromUi(ui, feature);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="he"');
    expect(html).toContain("שם");
    expect(html).toContain("Test");
    expect(html).toContain('class="layer-popup__actions"');
  });

  it("includes a single CTA for pink (node) mode when includeCta is true", () => {
    const ui = {
      popup: {
        fields: [{ key: "name", label: "name" }],
      },
    };
    const feature: Feature = {
      type: "Feature",
      properties: { name: "Spot" },
      geometry: { type: "Point", coordinates: [0, 0] },
    };
    const html = popupContentFromUi(ui, feature, { includeCta: true, ctaMode: "pink" });
    expect(html).toContain("data-layer-popup-cta");
    expect(html).toContain('data-layer-popup-cta="create_pink_node"');
    expect(html).not.toContain('data-layer-popup-cta="create_memorial"');
  });

  it("includes a single CTA for memorial mode when includeCta is true", () => {
    const ui = {
      popup: {
        fields: [{ key: "name", label: "name" }],
      },
    };
    const feature: Feature = {
      type: "Feature",
      properties: { name: "Spot" },
      geometry: { type: "Point", coordinates: [0, 0] },
    };
    const html = popupContentFromUi(ui, feature, { includeCta: true, ctaMode: "memorial" });
    expect(html).toContain('data-layer-popup-cta="create_memorial"');
    expect(html).not.toContain('data-layer-popup-cta="create_pink_node"');
  });

  it("returns empty string when no field values and no title", () => {
    const ui = {
      popup: {
        fields: ["a"],
        hideEmpty: true,
      },
    };
    const feature: Feature = {
      type: "Feature",
      properties: { a: null },
      geometry: { type: "Point", coordinates: [0, 0] },
    };
    expect(popupContentFromUi(ui, feature)).toBe("");
  });

  it("shows title from titleField and omits duplicate row", () => {
    const ui = {
      popup: {
        titleField: "Site_name",
        fields: [
          { key: "Site_name", label: "Site_name" },
          { key: "Setl_Name", label: "Setl_Name" },
        ],
        hideEmpty: true,
      },
    };
    const html = popupContentFromUi(ui, {
      type: "Feature",
      properties: { Site_name: "Alpha", Setl_Name: "Beta" },
      geometry: { type: "Point", coordinates: [0, 0] },
    });
    expect(html).toContain("layer-popup__title");
    expect(html).toContain("Alpha");
    expect(html).toMatch(/שם יישוב/);
    expect(html).toContain("Beta");
    expect(html).not.toContain("שם אתר");
  });
});

describe("renderLayerPopupHtml", () => {
  it("includes empty actions slot by default and injects actionsHtml when set", () => {
    const base = renderLayerPopupHtml({
      title: "T",
      rows: [{ label: "L", value: "V" }],
    });
    expect(base).toContain('class="layer-popup__actions"');
    expect(base).not.toContain("layer-popup__btn");

    const withCta = renderLayerPopupHtml({
      title: "T",
      rows: [{ label: "L", value: "V" }],
      actionsHtml: '<button type="button" class="layer-popup__btn">CTA</button>',
    });
    expect(withCta).toContain("layer-popup__btn");
    expect(withCta).toContain("CTA");
  });
});

describe("buildLayerPopupPayload", () => {
  it("maps October 7th–style keys to Hebrew when labels are English placeholders", () => {
    const payload = buildLayerPopupPayload({
      ui: {
        popup: {
          fields: [
            { key: "Oct7_desc", label: "Oct7_desc" },
            { key: "General_De", label: "General_De" },
          ],
        },
      },
      properties: { Oct7_desc: "x", General_De: "y" },
    });
    expect(payload?.rows.map((r) => r.label)).toEqual([
      "תיאור (7 באוקטובר)",
      "תיאור כללי",
    ]);
  });
});

describe("pickPropertiesFromPmtilesDebugPick", () => {
  it("prefers the requested MVT layer name when present", () => {
    const picked = new Map([
      [
        "src",
        [
          { layerName: "other", feature: { props: { a: "1" } } },
          { layerName: "layer", feature: { props: { name: "pick-me" } } },
        ],
      ],
    ]);
    expect(pickPropertiesFromPmtilesDebugPick(picked, "layer")).toEqual({ name: "pick-me" });
  });

  it("falls back to any layer when the preferred name has no hits", () => {
    const picked = new Map([
      ["src", [{ layerName: "foo", feature: { props: { z: "9" } } }]],
    ]);
    expect(pickPropertiesFromPmtilesDebugPick(picked, "layer")).toEqual({ z: "9" });
  });
});
