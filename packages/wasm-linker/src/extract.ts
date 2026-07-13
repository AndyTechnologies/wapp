import { spawn, spawnSync } from 'child_process';
import * as tar from 'tar';
import fs from 'fs';
import path from 'path';
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

async function extractZipInner(archive: string, cwd: string): Promise<void> {
  if (os.platform() === 'win32') {
    // Try tar first (faster on Windows Server 2025+), fallback to PowerShell
    const tarProc = spawn('tar', ['-xf', archive, '-C', cwd], { stdio: 'inherit' });
    try {
      await new Promise<void>((resolve, reject) => {
        tarProc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`tar -xf fallo: ${code}`)));
        tarProc.on('error', reject);
      });
      return;
    } catch {
      const ps = spawn('powershell', [
        '-NoProfile', '-Command',
        `Expand-Archive -Path '${archive}' -DestinationPath '${cwd}' -Force`,
      ], { stdio: 'inherit' });
      return new Promise<void>((resolve, reject) => {
        ps.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Expand-Archive fallo: ${code}`)));
        ps.on('error', reject);
      });
    }
  }

  const proc = spawn('unzip', ['-o', archive, '-d', cwd], { stdio: 'inherit' });
  return new Promise<void>((resolve, reject) => {
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`unzip fallo: ${code}`)));
    proc.on('error', reject);
  });
}

export async function extractZip(archive: string, cwd: string, strip: number = 0): Promise<void> {
  if (strip > 0) {
    const tmpDir = path.join(cwd, `.tmp_extract_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      await extractZipInner(archive, tmpDir);
      const entries = fs.readdirSync(tmpDir).filter(e => e !== '.' && e !== '..');

      if (strip === 1 && entries.length === 1 && fs.statSync(path.join(tmpDir, entries[0])).isDirectory()) {
        const topDir = path.join(tmpDir, entries[0]);
        const innerEntries = fs.readdirSync(topDir);
        for (const entry of innerEntries) {
          fs.renameSync(path.join(topDir, entry), path.join(cwd, entry));
        }
      } else {
        for (const entry of entries) {
          fs.renameSync(path.join(tmpDir, entry), path.join(cwd, entry));
        }
      }
    } finally {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  } else {
    await extractZipInner(archive, cwd);
  }
}
