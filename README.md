# DHTMLX Suite Angular Viewer Template + BabylonJS

Angular 21 template for CAD-style administration UI using DHTMLX Suite as the shell and BabylonJS as the 3D engine.

This repository is based on the template workflow and now includes a working Babylon viewer inside the DHTMLX layout main viewport.

## Current Status

Implemented:
- Angular shell and config-driven DHTMLX layout
- BabylonJS scene integration inside `main-viewer-area`
- GLB loading pipeline (`public/models/RDX.glb`)
- Camera fit from reusable model bounds feature
- Ground grid behavior (scaled from model bounds)
- Reflection environment/material pass (reusable feature)
- Layout resize stability fix for collapse/expand/resize

Not implemented yet:
- Full viewer interaction suite from vanilla demo (tree selection sync, isolate, advanced overlays)
- Backend-driven runtime config endpoints (currently static JSON)

## Stack

- Angular CLI 21.2.x
- DHTMLX Suite 9.x (`dhx-suite`)
- BabylonJS 9.x (`@babylonjs/core`, `@babylonjs/loaders`, `@babylonjs/materials`)
- TypeScript 5.9.x

## Run Locally

```bash
npm install
npm start
```

Default URL is usually `http://localhost:4200/`.
If the port is busy, Angular CLI will prompt for a different port.

## Build

```bash
npm run build
```

Note: production build currently fails because the default Angular bundle budget is exceeded after BabylonJS integration. This is expected at the current stage.

## Test

```bash
npm test
```

Note: test runs may fail in this template while working with static/demo JSON auth flows. This is expected for the current static mode and does not block local viewer development.

## Known Errors (Current Stage)

### 1) Production build budget error

Typical error:
- `bundle initial exceeded maximum budget`

Why it happens:
- Angular production build enforces size budgets from `angular.json`.
- After adding BabylonJS packages (`@babylonjs/core`, loaders, materials), the initial bundle is bigger than the template's default budget limits.
- This is not a runtime crash; it is a build-time budget guard.

Current impact:
- `npm start` works for local development.
- `npm run build` fails until budgets are adjusted or viewer code is split/lazy-loaded.

### 2) Test errors with static config URLs

Typical errors:
- `Failed to parse URL from /config/viewer-layout.config.json`
- `Failed to parse URL from /config/sidebar.data.json`
- `Failed to parse URL from /config/top-menu.data.json`

Why it happens:
- The app currently runs in static/demo mode and loads config/auth-related JSON from absolute browser-style paths under `/config/...`.
- In Vitest/Node test environment, there is no real browser origin serving these files, so `fetch('/config/...')` becomes an invalid URL in that context.
- DHTMLX data loading and viewer bootstrap depend on these JSON files during component initialization.

Current impact:
- Unit tests may fail in CI/local test runs unless fetch/config loading is mocked.
- This behavior is expected in the current static template stage.

## Viewer Architecture

Main viewer component:
- `src/app/features/viewer/viewer.module.component.ts`

Reusable viewer features:
- `src/app/features/viewer/model-bounds.ts`
	- Centralized world bounds calculation utility
	- Reused for camera fit and grid sizing
- `src/app/features/viewer/viewer-reflections.ts`
	- Reflection environment initialization
	- Reflection application on PBR/Standard materials

### Why this split

The goal is to keep viewer orchestration in the component and move reusable technical logic into isolated feature modules. This allows the same math/visual behaviors to be reused in future viewer actions without duplicating logic.

## DHTMLX + Babylon Resize Stability Fix

When the model browser cell is collapsed/expanded or resized, the Babylon canvas can become visually distorted if the engine viewport is not resized at the right time.

Implemented fix:
- DHTMLX layout event hooks: `afterCollapse`, `afterExpand`, `resize`, `afterResizeEnd`
- `ResizeObserver` on the actual viewer container
- Frame-scheduled viewport refresh (`engine.resize()` + `scene.render()`)

This combination fixes the visual issue during:
- Collapse/expand of `model-browser`
- Manual cell resize
- Generic layout invalidation cycles

## Config-Driven Shell

UI shell remains config-driven via static JSON files:
- `public/config/sidebar.data.json`
- `public/config/top-menu.data.json`
- `public/config/viewer-layout.config.json`

This keeps the template backend-ready: static JSON can later be replaced by API responses with the same schema.

## Screenshot

![Viewer UI Screenshot](docs/assets/screenshots/screenshot-04.png)
