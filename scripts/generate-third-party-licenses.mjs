import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const packageJsonPath = join(root, 'package.json');
const outputPath = join(root, 'THIRD_PARTY_LICENSES.md');

function getLicenseText(pkg) {
  if (typeof pkg.license === 'string' && pkg.license.trim().length > 0) {
    return pkg.license;
  }

  if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
    return pkg.licenses
      .map((entry) => (typeof entry === 'string' ? entry : entry?.type || 'UNKNOWN'))
      .join(', ');
  }

  return 'UNKNOWN';
}

function escapeMarkdownCell(value) {
  return String(value).replace(/\|/g, '\\|');
}

const rootPackage = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const directDeps = {
  ...(rootPackage.dependencies || {}),
  ...(rootPackage.devDependencies || {})
};

const dependencyNames = Object.keys(directDeps).sort((a, b) => a.localeCompare(b));

const rows = dependencyNames.map((name) => {
  const dependencyPackagePath = join(root, 'node_modules', name, 'package.json');

  try {
    const dependencyPackage = JSON.parse(readFileSync(dependencyPackagePath, 'utf8'));

    return {
      name,
      version: dependencyPackage.version || '',
      license: getLicenseText(dependencyPackage)
    };
  } catch {
    return {
      name,
      version: '',
      license: 'UNKNOWN'
    };
  }
});

const generatedOn = new Date().toISOString().slice(0, 10);

const lines = [
  '# Third-Party Licenses',
  '',
  'This file documents direct dependencies used by this repository and their declared licenses.',
  '',
  'Source of truth:',
  '- package.json direct dependencies/devDependencies',
  '- installed package manifests in node_modules/*/package.json',
  '',
  `Generated on: ${generatedOn}`,
  '',
  '## Direct dependency license inventory',
  '',
  '| Package | Version | Declared license |',
  '| --- | --- | --- |',
  ...rows.map((row) => `| ${escapeMarkdownCell(row.name)} | ${escapeMarkdownCell(row.version)} | ${escapeMarkdownCell(row.license)} |`),
  '',
  '## Notes',
  '',
  '- This project includes dhx-suite under GPL terms.',
  '- When redistributing this project, ensure recipients can access the complete corresponding source code and this license documentation.',
  '- For full legal text of GPL v2.0 used by this repository, see LICENSE.',
  '- For dhx-suite package text bundled from npm, see node_modules/dhx-suite/license.txt.',
  '',
  '## How to refresh this inventory',
  '',
  'Run from repository root:',
  '',
  '```bash',
  'npm run licenses:generate',
  '```',
  '',
  'To validate that the file is up to date (used by CI):',
  '',
  '```bash',
  'npm run licenses:check',
  '```',
  ''
];

writeFileSync(outputPath, `${lines.join('\n')}`, 'utf8');
console.log(`Updated ${outputPath}`);
