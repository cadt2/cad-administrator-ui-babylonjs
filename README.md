# Angular + DHTMLX Suite Viewer Starter

Clean starter template for building a Viewer module UI with Angular and DHTMLX Suite.

This starter uses the open-source version of DHTMLX Suite (NPM package: `dhx-suite`).

## UI Preview

![Viewer UI Screenshot](docs/assets/screenshots/screenshots-01.png)

*Preview v0.3.0 - Config-Driven UI Baseline*

This repository intentionally includes:
- Angular app shell
- DHTMLX Suite integration
- Viewer module baseline layout (3L-style structure)

This repository intentionally does not include:
- BabylonJS integration
- Full PDM or Inventory module implementations

## Stack

- Angular CLI 21.2.x
- DHTMLX Suite 9.x
- TypeScript 5.9.x

## Run locally

```bash
npm install
npm start
```

Open http://localhost:4200/

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Starter scope

Current template scope is focused on Viewer UI foundation:
- Left panel: Assembly Browser placeholder
- Top strip: Viewer Tools placeholder
- Main area: Viewer canvas placeholder

You can extend this baseline with your own business modules and rendering engine later.

## Non-Intrusive UI Architecture (Config-Driven)

One of the core design decisions in this template is to keep UI composition driven by configuration, not hardcoded component logic.

Why this matters:
- Once a UI/UX is approved, teams should be able to evolve labels, menu items, ordering, visibility, and feature toggles without rewriting components.
- It reduces regression risk because structural changes happen in config payloads instead of view logic.
- It supports localization and tenant-specific customization with minimal code changes.
- It makes backend integration straightforward, because config can be served from settings endpoints or a DB-backed configuration service.

Current implementation follows this pattern:
- Sidebar items are loaded through DHTMLX data loading API from public config JSON.
- Top menu items and top label are loaded through DHTMLX data loading API from public config JSON.
- Viewer layout structure is loaded from external JSON and then passed into DHTMLX Layout initialization.

Current config files:
- public/config/sidebar.data.json
- public/config/top-menu.data.json
- public/config/viewer-layout.config.json

### Practical benefits for product teams

- Non-intrusive evolution: add/remove entries without editing component templates.
- Faster experimentation: A/B test labels and UI structure through config revisions.
- Cleaner codebase: components focus on behavior and events, not static content definition.
- Backend-ready contract: move from static JSON files to API responses with the same schema.

### Suggested backend progression

1. Keep the existing JSON schema as the canonical UI contract.
2. Expose endpoints such as /api/ui-config/sidebar, /api/ui-config/top-menu, and /api/ui-config/viewer-layout.
3. Add environment/tenant/language selection on the backend.
4. Version the config contract to support safe rollout and rollback.

This approach preserves the UI design system while enabling long-term scalability and maintainability.
