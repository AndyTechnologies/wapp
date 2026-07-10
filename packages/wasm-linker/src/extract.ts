import { spawn } from 'child_process';
import * as tar from 'tar';
import os from 'os';

export async function extractTarXz(archive: string, cwd: string, strip: number): Promise<void> {
  if (os.platform() === 'win32') {
    // Windows usa .zip, no deberia llegar aqui, pero por si acaso:
    await tar.x({ file: archive, cwd, strip });
    return;
  }

  // Descomprimimos xz via pipe (xz -dc) y extraemos tar con npm tar.
  // xz es el formato de compresion estandar de Zig/Wasmtime.
  // La extraccion del formato tar la hace npm tar, no el comando del sistema.
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
        `No se pudo ejecutar 'xz': ${err.message}. En Linux: apt install xz-utils (o pacman -S xz). En macOS: brew install xz.`,
      ));
    });
  });
}

export async function extractZip(archive: string, cwd: string): Promise<void> {
  if (os.platform() === 'win32') {
    const proc = spawn('powershell', [
      '-NoProfile', '-Command',
      `Expand-Archive -Path '${archive}' -DestinationPath '${cwd}' -Force`,
    ], { stdio: 'inherit' });
    return new Promise<void>((resolve, reject) => {
      proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Expand-Archive fallo: ${code}`)));
      proc.on('error', reject);
    });
  }

  const proc = spawn('unzip', ['-o', archive, '-d', cwd], { stdio: 'inherit' });
  return new Promise<void>((resolve, reject) => {
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`unzip fallo: ${code}`)));
    proc.on('error', reject);
  });
}
