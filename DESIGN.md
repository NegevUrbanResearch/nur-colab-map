---
version: "alpha"
name: "Nur Colab Map"
description: "Mobile-first RTL map UI with dark glass overlays for planning workflows."
colors:
  surface-canvas: "#0D1016"
  surface-glass: "#141414"
  surface-panel: "#18181C"
  border-soft: "#FFFFFF29"
  text-primary: "#FFFFFFF2"
  text-secondary: "#FFFFFFB3"
  accent-pink: "#FF69B4"
  accent-green-a: "#39B96B"
  accent-green-b: "#60D58E"
  danger-soft: "#DC3232"
typography:
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.3
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.35
  title-sm:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 700
    lineHeight: 1.35
rounded:
  xs: 8px
  sm: 10px
  md: 12px
  lg: 14px
  pill: 999px
spacing:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 10px
  xl: 12px
components:
  map-glass-bar:
    backgroundColor: "{colors.surface-glass}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  button-primary:
    backgroundColor: "{colors.accent-green-a}"
    textColor: "#052210"
    rounded: "{rounded.xs}"
    padding: "{spacing.md}"
  button-secondary:
    backgroundColor: "{colors.surface-glass}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xs}"
    padding: "{spacing.md}"
  chip:
    backgroundColor: "{colors.surface-glass}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "{spacing.sm}"
---

## Overview

`nur-colab-map` uses a map-first, dark-glass interface where overlays support editing and planning without hiding geographic context.  
Hebrew + RTL is the default product language and layout direction.

## Colors

- **Canvas:** deep dark surfaces (`surface-canvas`) keep satellite maps legible under overlays.
- **Glass overlays:** translucent dark bars/panels with low-opacity white borders.
- **Text:** high-contrast white with softer secondary copy.
- **Accents:** pink for project/heritage highlights, green for primary positive actions.
- **Danger:** soft red tint for destructive actions (`נקה הכל`, delete/clear patterns).

## Typography

- Base UI text is compact (`body-sm`, `body-md`) to preserve map space on mobile.
- Titles and section headers use `title-sm`.
- Preferred stack in implementation/mocks: `Inter, "Noto Sans Hebrew", Arial, sans-serif`.

## Layout

- **Mobile-first safe-area model:** overlays respect `--map-safe-*` and `env(safe-area-inset-*)`.
- **Map insets:** map viewport is padded vertically by `--map-top-chrome` and `--map-bottom-chrome`.
- **Chrome zones:**
  - **Top zone (global):** submission/project/account controls.
  - **Bottom zone (contextual):** project-specific editing toolbar (pink/memorial).
- New persistent controls should dock to these existing zones, not create disconnected floating islands.

## Elevation & Depth

- Use subtle blur (`12-14px`) and soft borders for bars/popovers.
- Stronger panel opacity for sheets/modals than for persistent bars.
- Keep shadows restrained; avoid heavy glow except for active/emphasis states.

## Shapes

- Small controls: `rounded.xs` (8px)
- Toolbar/panel shells: `rounded.sm` / `rounded.md` (10-12px)
- Modal/sheet major surfaces: `rounded.lg` (14px+)
- Counts/chips/toggles: `rounded.pill`

## Components

### Existing Shell Contract

- **Top control cluster** remains the canonical home for global map context.
- **Bottom toolbar** remains the canonical home for edit-mode actions.
- Layer/basemap/legend controls must integrate around this shell.

### Layer Control Pattern (V1 target)

- One compact trigger (`שכבות (N)`) near existing global or bottom-adjacent controls.
- Bottom sheet for full layer operations:
  - `הצג הכל`
  - `הסתר הכל`
  - pack toggles
  - per-layer toggles
  - basemap segmented row (`לוויין | OSM`)
- Show pack state as `off | partial | on` with counts (`2/5`).

### Legend Pattern

- Legend is controlled explicitly via `מקרא`.
- Legend display is grouped by **active packs only**.
- On mobile, legend should be a compact tray/card or sheet tab, not a permanent large panel.

### Basemap Pattern

- V1 scope: binary switch only (`לוויין` / `OSM`).
- Basemap changes must not alter layer visibility state.

## Do's and Don'ts

### Do

- Design in RTL/Hebrew from the start.
- Keep controls dense but tappable.
- Minimize vertical spacing between new and existing controls when screen pressure is high.
- Keep map visibility primary.
- Reflect real shell constraints in mockups (top + bottom existing bars).

### Don't

- Do not introduce bright/light UI islands that clash with current dark-glass style.
- Do not hide key controls behind deep nested interactions.
- Do not duplicate control responsibilities across multiple permanent panels.
- Do not let legend dominate the viewport on mobile.
- Do not ship mockups that ignore existing toolbar placement or safe-area behavior.

## Mockup Authoring Rules

For files under `docs/superpowers/mockups/*.html`:

- Use standalone HTML (inline CSS/JS, no build step required).
- Set `<html lang="he" dir="rtl">`.
- Show **current shell + new overlay additions** unless intentionally exploring shell redesign.
- Include at least two states where relevant (closed/open, legend hidden/shown).
- Use realistic Hebrew labels and counts from project context.

## Review Checklist

- Does it match current app shell structure?
- Is RTL/Hebrew correctly applied?
- Is mobile spacing realistic (especially vertical stack pressure)?
- Are layer, basemap, and legend responsibilities clear and separate?
- Can user do all required layer actions (show all/hide all + per-layer)?
- Is legend control location clear, and legend display location clear?
