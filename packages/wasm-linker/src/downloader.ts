import fs from 'fs';
import https from 'https';
import http from 'http';
import { pipeline } from 'stream/promises';

export interface DownloadOptions {
  ignoreCache?: boolean;
  onProgress?: (received: number, total: number) => void;
}

export class DownloadError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly statusCode?: number,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'DownloadError';
  }
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

      // Follow redirects manually if needed (https.get follows by default,
      // but we keep this for safety)
      if (statusCode >= 301 && statusCode <= 308) {
        const location = response.headers.location;
        if (!location) {
          reject(new DownloadError(`Redirección sin Location`, fileUrl, statusCode));
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
              `Reanudará en el próximo intento.\n`,
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
        `Error de conexión: ${err.message}`,
        fileUrl,
        undefined,
        err,
      ));
    });

    req.end();
  });
}
