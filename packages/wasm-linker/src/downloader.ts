import fs from 'fs';
import https from 'https';
import http from 'http';
import { pipeline } from 'stream/promises';
import { DownloadError } from 'wapp-types';

export interface DownloadOptions {
  ignoreCache?: boolean;
  onProgress?: (received: number, total: number) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const progressTimestamps = new Map<string, number>();

export function renderProgressBar(label: string, received: number, total: number): void {
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

export function clearProgressLine(): void {
  process.stderr.write('\r' + ' '.repeat(80) + '\r');
}

export async function downloadFileWithResume(
  fileUrl: string,
  dest: string,
  options?: DownloadOptions,
): Promise<void> {
  const partPath = dest + '.part';
  const ignoreCache = options?.ignoreCache ?? false;
  const onProgress = options?.onProgress;

  let startByte = 0;
  if (!ignoreCache && fs.existsSync(partPath)) {
    startByte = fs.statSync(partPath).size;
  }

  const isHttps = fileUrl.startsWith('https:');
  const protocol = isHttps ? https : http;

  await new Promise<void>((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (startByte > 0) {
      headers['Range'] = `bytes=${startByte}-`;
    }

    const req = protocol.get(fileUrl, { headers }, async (response) => {
      const statusCode = response.statusCode!;

      if (statusCode >= 301 && statusCode <= 308) {
        const location = response.headers.location;
        if (!location) {
          reject(new DownloadError(`Redireccion sin Location`, fileUrl, statusCode));
          return;
        }
        response.destroy();
        resolve(downloadFileWithResume(location, dest, options));
        return;
      }

      if (statusCode === 416) {
        if (fs.existsSync(partPath)) {
          fs.renameSync(partPath, dest);
        }
        resolve();
        return;
      }

      if (startByte > 0 && statusCode === 200) {
        startByte = 0;
        if (fs.existsSync(partPath)) {
          fs.unlinkSync(partPath);
        }
      }

      if (statusCode !== 200 && statusCode !== 206) {
        reject(new DownloadError(
          `Error HTTP ${statusCode}`,
          fileUrl,
          statusCode,
        ));
        return;
      }

      const totalContentLength = parseInt(response.headers['content-length'] || '0', 10);
      const totalBytes = startByte + totalContentLength;
      let received = startByte;

      const fileStream = fs.createWriteStream(partPath, startByte > 0 ? { flags: 'a' } : undefined);

      response.on('data', (chunk: Buffer) => {
        received += chunk.length;
        onProgress?.(received, totalBytes || received);
      });

      try {
        await pipeline(response, fileStream);
        fs.renameSync(partPath, dest);
        resolve();
      } catch (err: any) {
        fileStream.destroy();
        if (fs.existsSync(partPath)) {
          const partial = fs.statSync(partPath).size;
          if (partial > 0) {
            process.stderr.write(
              `\nDescarga interrumpida, parcial guardado (${partial} bytes). ` +
              'Reanudara en el proximo intento.\n',
            );
          }
        }
        reject(new DownloadError(
          `Error de red: ${err.message}`,
          fileUrl,
          undefined,
          err,
        ));
      }
    });

    req.on('error', (err) => {
      reject(new DownloadError(
        `Error de conexion: ${err.message}`,
        fileUrl,
        undefined,
        err,
      ));
    });

    req.end();
  });
}
