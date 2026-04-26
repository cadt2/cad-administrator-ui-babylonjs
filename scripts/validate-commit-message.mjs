#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const commitMsgFilePath = process.argv[2];

if (!commitMsgFilePath) {
  console.error('Commit message validation failed: missing commit message file path.');
  process.exit(1);
}

const commitMessage = readFileSync(commitMsgFilePath, 'utf8').trim();

if (!commitMessage) {
  console.error('Commit message validation failed: empty commit message.');
  process.exit(1);
}

const conventionalCommitPattern = /^(feat|fix|refactor|perf|docs|test|build|ci|chore|revert)(\([a-z0-9\-\/]+\))?!?:\s.+$/;
if (!conventionalCommitPattern.test(commitMessage)) {
  console.error('Commit message validation failed: use conventional commit format, e.g. "feat(viewer): add model selection".');
  process.exit(1);
}

const containsAccentedChars = /[áéíóúñÁÉÍÓÚÑ]/.test(commitMessage);
if (containsAccentedChars) {
  console.error('Commit message validation failed: use English only (accented Spanish characters detected).');
  process.exit(1);
}

const commonSpanishWords = /\b(agregar|agrega|agregado|arreglar|arreglo|arquitectura|cambio|cambios|corregir|correccion|deseleccion|ensamblaje|feature\s+de|modelo|seleccion|vamos|hagamos)\b/i;
if (commonSpanishWords.test(commitMessage)) {
  console.error('Commit message validation failed: Spanish terms detected, please use English wording.');
  process.exit(1);
}

process.exit(0);