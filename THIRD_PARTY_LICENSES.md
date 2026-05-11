# Third-Party Licenses

This file documents direct dependencies used by this repository and their declared licenses.

Source of truth:
- package.json direct dependencies/devDependencies
- installed package manifests in node_modules/*/package.json

Generated on: 2026-05-11

## Direct dependency license inventory

| Package | Version | Declared license |
| --- | --- | --- |
| @angular/build | 21.2.7 | MIT |
| @angular/cli | 21.2.7 | MIT |
| @angular/common | 21.2.9 | MIT |
| @angular/compiler | 21.2.9 | MIT |
| @angular/compiler-cli | 21.2.9 | MIT |
| @angular/core | 21.2.9 | MIT |
| @angular/forms | 21.2.9 | MIT |
| @angular/platform-browser | 21.2.9 | MIT |
| @angular/router | 21.2.9 | MIT |
| @babylonjs/core | 9.3.3 | Apache-2.0 |
| @babylonjs/loaders | 9.3.3 | Apache-2.0 |
| @babylonjs/materials | 9.3.3 | Apache-2.0 |
| @fortawesome/fontawesome-free | 7.2.0 | (CC-BY-4.0 AND OFL-1.1 AND MIT) |
| @mdi/font | 7.4.47 | Apache-2.0 |
| dhx-suite | 9.3.1 | GPL |
| jsdom | 28.1.0 | MIT |
| prettier | 3.8.3 | MIT |
| rxjs | 7.8.2 | Apache-2.0 |
| tslib | 2.8.1 | 0BSD |
| typescript | 5.9.3 | Apache-2.0 |
| vitest | 4.1.4 | MIT |

## Notes

- This project includes dhx-suite under GPL terms.
- When redistributing this project, ensure recipients can access the complete corresponding source code and this license documentation.
- For full legal text of GPL v2.0 used by this repository, see LICENSE.
- For dhx-suite package text bundled from npm, see node_modules/dhx-suite/license.txt.

## How to refresh this inventory

Run from repository root:

```bash
npm run licenses:generate
```

To validate that the file is up to date (used by CI):

```bash
npm run licenses:check
```
