import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import type { WappConfig, CrossCompileTarget } from 'wapp-types';

export const DEFAULT_CONFIG: WappConfig = {
  sourceDir: 'src/assembly',
  outDir: 'build',
  entry: '_start',
  wasi: false,
  moduleMatching: 'name-only',
  target: undefined,
  compiler: {
    release: false,
    runtime: 'incremental',
    optimizeLevel: 3,
    sourceMap: true,
  },
};

const CONFIG_FILES = ['wapp.json', 'wapp.config.json'];

export function findConfig(startDir?: string): { config: WappConfig; configPath: string } | null {
  const dir = startDir ?? process.cwd();
  for (const file of CONFIG_FILES) {
    const p = path.join(dir, file);
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as WappConfig;
      return { config: { ...DEFAULT_CONFIG, ...raw }, configPath: p };
    }
  }

  const parent = path.dirname(dir);
  if (parent !== dir) {
    return findConfig(parent);
  }
  return null;
}

export function loadConfig(dir?: string): WappConfig {
  const found = findConfig(dir);
  if (!found) {
    return { ...DEFAULT_CONFIG };
  }
  return found.config;
}

export function writeConfig(config: WappConfig, filePath: string): void {
  const merged = { ...DEFAULT_CONFIG, ...config };
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
}

export function resolveSourceFiles(sourceDir: string): string[] {
  const dir = path.resolve(sourceDir);
  if (!fs.existsSync(dir)) {
    return [];
  }
  const asFiles = glob.sync('**/*.{wasm.ts,asm.ts,ts,asm}', { cwd: dir, absolute: true, nodir: true });
  const wasmFiles = glob.sync('**/*.wasm', { cwd: dir, absolute: true, nodir: true });
  return [...asFiles, ...wasmFiles];
}

export function isAssemblyScriptFile(filePath: string): boolean {
  return filePath.endsWith('.wasm.ts') || filePath.endsWith('.asm.ts') || filePath.endsWith('.ts') || filePath.endsWith('.asm');
}
