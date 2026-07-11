import { ensureZigAvailable, getZigCachedPath, zigDownloadInfo } from './zig-downloader.js';
import { ensureWasmtimeAvailable, getWasmtimeCachedPaths, wasmtimeDownloadInfo } from './wasmtime-dl.js';
import { clearCache, getCacheInfo } from './cache.js';
import type { DownloadOptions } from './downloader.js';
import { renderProgressBar, clearProgressLine } from './downloader.js';

export interface SetupOptions {
  ignoreCache?: boolean;
}

export interface SetupStatus {
  zig: { status: 'ok' | 'missing' | 'error'; path?: string; error?: string };
  wasmtime: { status: 'ok' | 'missing' | 'error'; path?: string; error?: string };
  cacheSize: string;
}

export async function runSetup(options?: SetupOptions): Promise<void> {
  const ignoreCache = options?.ignoreCache ?? false;

  if (ignoreCache) {
    console.log('Ignorando cache existente, forzando descarga...');
    await clearCache();
  }

  console.log('');

  const cachedZig = getZigCachedPath();
  if (cachedZig && !ignoreCache) {
    console.log(`  [Zig]        ${cachedZig} — OK`);
  } else {
    const info = zigDownloadInfo();
    console.log(`  [Zig]        Descargando ${info.version}...`);

    const dlOpts: DownloadOptions = {
      ignoreCache,
      onProgress: (recv, total) => renderProgressBar('[Zig]', recv, total),
    };

    try {
      const path = await ensureZigAvailable(dlOpts);
      clearProgressLine();
      console.log(`  [Zig]        ${path} — OK`);
    } catch (err: any) {
      clearProgressLine();
      const msg = err.cause ? `${err.message} (causa: ${err.cause.message})` : err.message;
      console.error(`  [Zig]        ERROR — ${msg}`);
      if (err.statusCode) {
        console.error(`                URL: ${err.url}`);
        if (err.statusCode === 404) {
          console.error('                Sugerencia: La version especificada puede no existir.');
        }
      }
      throw err;
    }
  }

  const cachedWt = getWasmtimeCachedPaths();
  if (cachedWt && !ignoreCache) {
    console.log(`  [Wasmtime]   ${cachedWt.libPath} — OK`);
  } else {
    const info = wasmtimeDownloadInfo();
    console.log(`  [Wasmtime]   Descargando ${info.version}...`);

    const dlOpts: DownloadOptions = {
      ignoreCache,
      onProgress: (recv, total) => renderProgressBar('[Wasmtime]', recv, total),
    };

    try {
      const paths = await ensureWasmtimeAvailable(dlOpts);
      clearProgressLine();
      console.log(`  [Wasmtime]   ${paths.libPath} — OK`);
    } catch (err: any) {
      clearProgressLine();
      const msg = err.cause ? `${err.message} (causa: ${err.cause.message})` : err.message;
      console.error(`  [Wasmtime]   ERROR — ${msg}`);
      if (err.statusCode) {
        console.error(`                URL: ${err.url}`);
        if (err.statusCode === 302) {
          console.error('                Sugerencia: Puede haber una redireccion no seguida automaticamente.');
        }
      }
      throw err;
    }
  }

  console.log('\n  Setup completado.');
}

export async function checkSetupStatus(): Promise<SetupStatus> {
  const cachedZig = getZigCachedPath();
  const cachedWt = getWasmtimeCachedPaths();

  const zigStatus: SetupStatus['zig'] = cachedZig
    ? { status: 'ok', path: cachedZig }
    : { status: 'missing' };

  const wtStatus: SetupStatus['wasmtime'] = cachedWt
    ? { status: 'ok', path: cachedWt.libPath }
    : { status: 'missing' };

  const info = await getCacheInfo();

  return { zig: zigStatus, wasmtime: wtStatus, cacheSize: info.humanSize };
}
