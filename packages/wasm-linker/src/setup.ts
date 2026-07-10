import { ensureZigAvailable, getZigCachedPath, zigDownloadInfo } from './zig-downloader.js';
import { ensureWasmtimeAvailable, getWasmtimeCachedPaths, wasmtimeDownloadInfo } from './wasmtime-dl.js';
import { clearCache, getCacheInfo } from './cache.js';
import type { DownloadOptions } from './downloader.js';

export interface SetupOptions {
  ignoreCache?: boolean;
}

export interface SetupStatus {
  zig: { status: 'ok' | 'missing' | 'error'; path?: string; error?: string };
  wasmtime: { status: 'ok' | 'missing' | 'error'; path?: string; error?: string };
  cacheSize: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const progressTimestamps = new Map<string, number>();

function renderProgressBar(label: string, received: number, total: number): void {
  const now = Date.now();
  const last = progressTimestamps.get(label) || 0;
  if (now - last < 100) return;
  progressTimestamps.set(label, now);

  const barWidth = 30;
  const pct = total > 0 ? (received / total) * 100 : 0;
  const filled = Math.round((pct / 100) * barWidth);
  const bar = '='.repeat(filled) + '-'.repeat(barWidth - filled);

  const pctStr = total > 0 ? `${pct.toFixed(1)}%` : '?%';
  const recvStr = formatBytes(received);
  const totalStr = total > 0 ? formatBytes(total) : '?';

  const labelPad = label.padEnd(12);
  process.stderr.write(`\r  ${labelPad} [${bar}] ${pctStr.padStart(6)}  ${recvStr.padStart(8)} / ${totalStr.padStart(8)}`);
}

function clearProgressLine(): void {
  process.stderr.write('\r' + ' '.repeat(80) + '\r');
}

export async function runSetup(options?: SetupOptions): Promise<void> {
  const ignoreCache = options?.ignoreCache ?? false;

  if (ignoreCache) {
    console.log('Ignorando cache existente, forzando descarga...');
    await clearCache();
  }

  console.log('');

  // ── Zig ──────────────────────────────────────────────
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
          console.error('                Sugerencia: La versión especificada puede no existir.');
        }
      }
      throw err;
    }
  }

  // ── Wasmtime ─────────────────────────────────────────
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
          console.error('                Sugerencia: Puede haber una redirección no seguida automáticamente.');
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
