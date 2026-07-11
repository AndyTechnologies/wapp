import { spawn, spawnSync } from 'child_process';
import * as tar from 'tar';
import os from 'os';

async function extractWithXzPipe(archive: string, cwd: string, strip: number): Promise<void> {
  const xz = spawn('xz', ['-dc', archive], { stdio: ['ignore', 'pipe', 'inherit'] });
  const extractor = tar.x({ cwd, strip });

  xz.stdout.pipe(extractor);

  return new Promise<void>((resolve, reject) => {
    let closed = false;
    const done = () => { if (!closed) { closed = true; resolve(); } };

    extractor.on('close', done);
    extractor.on('error', (err) => { closed = true; reject(err); });
    xz.on('error', (err) => {
      closed = true;
      reject(new Error(
        `No se pudo ejecutar 'xz': ${err.message}. En Linux: apt install xz-utils (o pacman -S xz). En macOS: brew install xz. En Windows: instale xz-utils desde https://tukaani.org/xz/`,
      ));
    });
  });
}

async function extractWithSystemTarXz(archive: string, cwd: string, strip: number): Promise<void> {
  const proc = spawn('tar', ['-xJf', archive, '--strip-components', strip.toString(), '-C', cwd], { stdio: 'inherit' });
  return new Promise<void>((resolve, reject) => {
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`tar -xJf fallo (codigo ${code})`)));
    proc.on('error', (err) => reject(new Error(`No se pudo ejecutar 'tar': ${err.message}.`)));
  });
}

export async function extractTarXz(archive: string, cwd: string, strip: number): Promise<void> {
  if (os.platform() === 'win32') {
    const which = spawnSync('where', ['xz'], { stdio: 'pipe' });
    if (which.status === 0) {
      await extractWithXzPipe(archive, cwd, strip);
    } else {
      await extractWithSystemTarXz(archive, cwd, strip);
    }
    return;
  }

  await extractWithXzPipe(archive, cwd, strip);
}

export async function extractZip(archive: string, cwd: string): Promise<void> {
  if (os.platform() === 'win32') {
    const ps = spawn('powershell', [
      '-NoProfile', '-Command',
      `Expand-Archive -Path '${archive}' -DestinationPath '${cwd}' -Force`,
    ], { stdio: 'inherit' });
    try {
      await new Promise<void>((resolve, reject) => {
        ps.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Expand-Archive fallo: ${code}`)));
        ps.on('error', reject);
      });
      return;
    } catch {
      // Fallback: tar -xf (available on Windows 10+)
      const proc = spawn('tar', ['-xf', archive, '-C', cwd], { stdio: 'inherit' });
      return new Promise<void>((resolve, reject) => {
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`tar -xf fallo: ${code}. No se pudo extraer el zip.`)));
        proc.on('error', reject);
      });
    }
  }

  const proc = spawn('unzip', ['-o', archive, '-d', cwd], { stdio: 'inherit' });
  return new Promise<void>((resolve, reject) => {
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`unzip fallo: ${code}`)));
    proc.on('error', reject);
  });
}
