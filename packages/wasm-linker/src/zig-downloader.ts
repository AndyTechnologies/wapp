import os from 'os';
import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { downloadFileWithResume, DownloadOptions } from './downloader.js';
import { extractTarXz } from './extract.js';

const ZIG_VERSION = '0.16.0';
const ZIG_BASE_URL = `https://ziglang.org/download/${ZIG_VERSION}`;

function getZigPlatformTriple(): string {
  const plat = os.platform();
  const arch = os.arch();
  const map: Record<string, string> = {
    'linux-x64': 'x86_64-linux',
    'darwin-x64': 'x86_64-macos',
    'darwin-arm64': 'aarch64-macos',
    'win32-x64': 'x86_64-windows',
  };
  return map[`${plat}-${arch}`] ?? `${plat}-${arch}`;
}

function zigCacheDir(): string {
  const newDir = path.join(os.homedir(), '.wasm-linker', 'zig', ZIG_VERSION);
  const oldDir = path.join(os.homedir(), '.wapp', 'zig', ZIG_VERSION);
  if (!fs.existsSync(newDir) && fs.existsSync(oldDir)) {
    return oldDir;
  }
  return newDir;
}

function zigExecutablePath(): string {
  const dir = zigCacheDir();
  const ext = os.platform() === 'win32' ? '.exe' : '';
  return path.join(dir, 'zig' + ext);
}

export function zigDownloadInfo(): { version: string; url: string; fileName: string } {
  const triple = getZigPlatformTriple();
  const ext = os.platform() === 'win32' ? 'zip' : 'tar.xz';
  const fileName = `zig-${triple}-${ZIG_VERSION}.${ext}`;
  const url = `${ZIG_BASE_URL}/${fileName}`;
  return { version: ZIG_VERSION, url, fileName };
}

export function getZigCachedPath(): string | null {
  const exe = zigExecutablePath();
  if (fs.existsSync(exe)) {
    return exe;
  }
  return null;
}

export async function ensureZigAvailable(dlOpts?: DownloadOptions): Promise<string> {
  if (process.env.ZIG_PATH && fs.existsSync(process.env.ZIG_PATH)) {
    return process.env.ZIG_PATH;
  }

  const cachedExe = getZigCachedPath();
  if (cachedExe && !dlOpts?.ignoreCache) {
    return cachedExe;
  }

  const which = spawnSync(os.platform() === 'win32' ? 'where' : 'which', ['zig']);
  if (which.status === 0 && which.stdout) {
    const sysZig = which.stdout.toString().trim();
    if (fs.existsSync(sysZig)) {
      return sysZig;
    }
  }

  const info = zigDownloadInfo();
  const cacheDir = zigCacheDir();

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const archivePath = path.join(cacheDir, info.fileName);
  await downloadFileWithResume(info.url, archivePath, dlOpts);

  console.log('Extrayendo Zig...');
  await extractTarXz(archivePath, cacheDir, 1);
  fs.unlinkSync(archivePath);

  const exe = zigExecutablePath();
  if (!fs.existsSync(exe)) {
    const entries = fs.readdirSync(cacheDir);
    const zigDir = entries.find(e => e.startsWith('zig-'));
    if (zigDir) {
      const actualExe = path.join(cacheDir, zigDir, 'zig' + (os.platform() === 'win32' ? '.exe' : ''));
      if (fs.existsSync(actualExe)) {
        fs.renameSync(actualExe, exe);
      }
    }
    if (!fs.existsSync(exe)) {
      throw new Error('No se encontro el ejecutable zig tras la extraccion.');
    }
  }

  if (os.platform() !== 'win32') {
    fs.chmodSync(exe, 0o755);
  }
  return exe;
}
