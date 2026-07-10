import asc from 'assemblyscript/asc'
import { readFileSync } from "node:fs";

import { LRUCache, MAX_MEMORY_CACHE_SIZE } from './lru.js';
import { compareHash, hashString, mergeAsConfig, resolveImportPath, ResolvedAlias } from './utils.js';


/**
 * Opciones para configurar la compilacion
 */
export interface CompileOptions {
  fileName: string;
  sourceCode: string;
  maxMemoryCacheSize?: number;
  ext?: string;
  isDev?: boolean;
  runtime?: string;
  sourceMap?: boolean;
  optimizeLevel?: number;
  shrinkLevel?: number;
  aliases?: ResolvedAlias[];
}

/**
 * Resultado de la compilación de AssemblyScript.
 */
export interface CompileResult {
  wasmBytes: Uint8Array;
  dtsContent: string;
  bindingsJs: string;
  sourceMap?: string;
  dependencies: string[];
  hash: string;
}

const MEMORY_CACHE = new LRUCache<string, CompileResult>();


export async function compileWasm(
  options: CompileOptions = {
    fileName: '',
    sourceCode: '',
    maxMemoryCacheSize: MAX_MEMORY_CACHE_SIZE,
    ext: ".wasm.ts",
    isDev: true,
    runtime: 'incremental',
    sourceMap: true,
    optimizeLevel: 3
  }
): Promise<CompileResult> {
  const opts = { ...options };
  const hash = hashString(opts.sourceCode);
  const fileCache = new LRUCache<string, string>(opts.maxMemoryCacheSize ?? MAX_MEMORY_CACHE_SIZE);

  if (MEMORY_CACHE.has(opts.fileName)) {
    const cached = MEMORY_CACHE.get(opts.fileName)!;
    if (compareHash(cached.hash, hash)) return cached;
    MEMORY_CACHE.delete(opts.fileName);
  }

  const readFileFromDisk = (filePath: string): string | null => {
    if (filePath === opts.fileName) return opts.sourceCode;
    if (fileCache.has(filePath)) return fileCache.get(filePath)!;
    try {
      const content = readFileSync(filePath, 'utf-8');
      fileCache.set(filePath, content);
      return content;
    } catch {
      return null;
    }
  };

  let wasmBytes: Uint8Array | null = null;
  let dtsContent: string | null = null;
  let bindingsJs: string | null = null;
  let sourceMap: string | null = null;

  const target = opts.isDev ? 'debug' : 'release';
  const configOptions = mergeAsConfig({}, target);

  // El archivo fuente debe ir antes que --sourceMap (que puede tomar un valor opcional)
  const baseArgs = [
    opts.fileName,
    '--runtime', opts.runtime || 'incremental',
    '--exportRuntime',
    '--bindings', 'raw',
    '--outFile', 'out.wasm',
  ];

  if (opts.isDev) {
    baseArgs.push('--debug');
    if (opts.sourceMap !== false) {
      baseArgs.push('--sourceMap');
    }
  } else {
    baseArgs.push('--optimize');
    if (opts.optimizeLevel !== undefined) {
      baseArgs.push('--optimizeLevel', opts.optimizeLevel.toString());
    }
    if (opts.shrinkLevel !== undefined) {
      baseArgs.push('--shrinkLevel', opts.shrinkLevel.toString());
    }
    baseArgs.push('--noAssert');
  }

  for (const [key, value] of Object.entries({...configOptions})) {
    if (typeof value === 'boolean') {
      if (value) baseArgs.push(`--${key}`);
    } else {
      baseArgs.push(`--${key}`, value.toString());
    }
  }

  

  const { error, stderr, stdout } = await asc.main(
    baseArgs,
    {
      readFile: (name: string) => {
        if (name === opts.fileName) return opts.sourceCode;
        if (name === 'asconfig.json') return null;
        const resolved = resolveImportPath(name, opts.fileName, opts.aliases || []);
        return readFileFromDisk(resolved);
      },
      writeFile: (name: string, contents: string | Uint8Array) => {
        if (name === 'out.wasm') {
          wasmBytes = contents as Uint8Array;
        } else if (name === 'out.js') {
          bindingsJs = contents as string;
        } else if (name === 'out.d.ts') {
          dtsContent = contents as string;
        } else if (name === 'out.wasm.map') {
          sourceMap = contents as string;
        }
      },
      listFiles: () => [],
    }
  );

  if (error) {
    throw new Error(`Error compilando AssemblyScript:\n${stderr?.toString() || ''}\n${stdout?.toString() || ''}`);
  }

  if (!wasmBytes || dtsContent === null || bindingsJs === null) {
    throw new Error('No se generaron todos los archivos necesarios');
  }

  const result = {
    wasmBytes,
    dtsContent,
    bindingsJs,
    sourceMap: sourceMap || undefined,
    dependencies: [],
    hash
  };

  MEMORY_CACHE.set(opts.fileName, result);
  return result;
}