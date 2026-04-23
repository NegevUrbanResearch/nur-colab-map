# Nur Colab Map — Layer Controls Mockups

Purpose: reviewable HTML mockups for layer controls, legend behavior, and basemap switching, aligned with the current `MapPage` visual language (dark glass chrome, RTL Hebrew labels, mobile-first layout).

| File | Role |
|------|------|
| `nur-colab-map-layer-controls-mockups.html` | Hub page with variant selector + embedded preview iframe. |
| `nur-colab-map-layer-controls-variant-c.html` | Variant C (chosen direction): current colab shell + compact bottom strip, cityscope-style horizontal pack strip + layer tiles, per-pack master toggle, persistent basemap + legend tray controls with no duplicated controls inside the layer sheet. |

## What these mockups include

- Pack-level toggle + per-layer toggles.
- Basemap switch (`לוויין` / `OSM`).
- Grouped legend behavior for multiple active packs.
- Mobile and desktop responsive behavior in one HTML each.
- Interactive control states (sheet open/close, toggles, variant-specific sections).

## What these mockups do not include

- Real map rendering.
- Real data loading from manifests.
- Supabase wiring.

## Related plan

- `../plans/2026-04-23-layer-controls-and-basemap.md`
