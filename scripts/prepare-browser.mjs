import chromium from '../apps/web/node_modules/@sparticuz/chromium/build/index.js';
import { mkdirSync, writeFileSync } from 'node:fs';
const path = await chromium.executablePath();
mkdirSync(new URL('../.data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../.data/browser-path', import.meta.url), path);
console.log(`Chromium executable prepared: ${path}`);
