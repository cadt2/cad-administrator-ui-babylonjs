# Angular + DHTMLX Suite Viewer Starter

Clean starter template for building a Viewer module UI with Angular and DHTMLX Suite.

This starter uses the open-source version of DHTMLX Suite (NPM package: `dhx-suite`).

## UI Preview

![Viewer UI Screenshot](docs/assets/screenshots/screenshot-02.png)

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

### Testing Note (Expected Failure in Demo Mode)

In this starter template, a failing test can be expected in demo mode.

Why it happens:
- The UI loads config from static JSON files using root-relative URLs like `/config/sidebar.data.json`, `/config/top-menu.data.json`, and `/config/viewer-layout.config.json`.
- During unit tests (Vitest/JSDOM), those URLs are not always resolved as in a real browser runtime.
- The authentication/permissions flow is also a demonstration setup (static checks), so test expectations around full runtime behavior are limited by design.

Result:
- You may see failing assertions or URL parsing/load errors during `npm test`.
- This is expected for the current demo baseline.

If you need stable CI tests, mock `fetch` and DHTMLX data loading for `/config/*` resources and isolate auth checks in dedicated unit tests.

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

### User Permissions (Demonstration)

This template includes a demonstration of how to implement user role-based permissions for the Sidebar, Top Menu, and Viewer Layout components. The permissions are defined in the JSON configuration files and checked in the components using the `AuthService`.

#### How It Works
1. **Permissions in JSON**: Each component's configuration file includes a `permissions` field that specifies the roles allowed to access it.
2. **AuthService**: The `AuthService` provides a method `hasPermission()` to check if the current user has the required roles.
3. **Component Logic**: Each component checks the permissions during initialization and logs a warning if the user does not have access.

#### Example
- Sidebar: Allowed roles are `admin` and `editor`.
- Top Menu: Allowed roles are `admin` and `viewer`.
- Viewer Layout: Allowed roles are `admin` and `viewer`.

#### Static Mode
By default, the template operates in static mode, and the permission checks are for demonstration purposes only. To enable dynamic role-based access, integrate the `AuthService` with a backend authentication system.
