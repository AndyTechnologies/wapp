import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { logger } from 'wapp-types';
import pc from 'picocolors';

export interface InstallResult {
  name: string;
  wasmFiles: string[];
  dir: string;
}

function isGitUrl(pkg: string): boolean {
  return pkg.endsWith('.git') || pkg.includes('github.com');
}

function getPackageName(pkg: string): string {
  if (isGitUrl(pkg)) {
    return path.basename(pkg, '.git');
  }
  if (fs.existsSync(pkg) && fs.statSync(pkg).isDirectory()) {
    return path.basename(pkg);
  }
  const parts = pkg.split('/');
  if (pkg.startsWith('@') && parts.length >= 2) {
    return parts[1];
  }
  return parts[0] ?? pkg;
}

function findWasmFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findWasmFiles(fullPath));
    } else if (entry.name.endsWith('.wasm')) {
      files.push(fullPath);
    }
  }
  return files;
}

function findPackageDir(nodeModulesDir: string, pkg: string): string | null {
  const pkgDir = path.join(nodeModulesDir, pkg);
  if (fs.existsSync(pkgDir)) return pkgDir;
  if (pkg.startsWith('@')) {
    const parts = pkg.split('/');
    const scopedDir = path.join(nodeModulesDir, parts[0], parts[1]);
    if (fs.existsSync(scopedDir)) return scopedDir;
  }
  if (fs.existsSync(nodeModulesDir)) {
    const entries = fs.readdirSync(nodeModulesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const candidate = path.join(nodeModulesDir, entry.name);
        const wasmFiles = findWasmFiles(candidate);
        if (wasmFiles.length > 0) return candidate;
      }
    }
  }
  return null;
}

function updateWappConfig(name: string, dev: boolean): void {
  const configPath = path.resolve('wapp.json');
  if (!fs.existsSync(configPath)) {
    logger.warn('No se encontro wapp.json, no se guardo la dependencia');
    return;
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);
  const field = dev ? 'wasmDevDependencies' : 'wasmDependencies';
  if (!config[field]) {
    config[field] = [];
  }
  if (!config[field].includes(name)) {
    config[field].push(name);
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  logger.success(`Dependencia guardada en wapp.json [${field}]`);
}

export async function installPackage(
  pkg: string,
  targetDir: string,
  options?: { saveDev?: boolean },
): Promise<InstallResult> {
  const name = getPackageName(pkg);
  const installDir = path.resolve(targetDir, name);

  logger.step(`Instalando modulo: ${pc.bold(name)}`);

  if (fs.existsSync(installDir)) {
    logger.warn(`El directorio ${installDir} ya existe. Sobrescribiendo...`);
    fs.rmSync(installDir, { recursive: true, force: true });
  }

  let wasmFiles: string[] = [];

  if (fs.existsSync(pkg) && fs.statSync(pkg).isDirectory()) {
    logger.info(`Usando directorio local: ${pkg}`);
    fs.cpSync(pkg, installDir, { recursive: true });
    wasmFiles = findWasmFiles(installDir);
  } else if (isGitUrl(pkg)) {
    logger.info(`Clonando repositorio: ${pkg}`);
    execSync(`git clone "${pkg}" "${installDir}"`, { stdio: 'inherit' });
    wasmFiles = findWasmFiles(installDir);
  } else {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wapp-install-'));
    try {
      logger.info(`Instalando paquete npm: ${pkg}`);
      execSync(`npm install "${pkg}"`, { cwd: tmpDir, stdio: 'inherit' });

      const nmDir = path.join(tmpDir, 'node_modules');
      const pkgDir = findPackageDir(nmDir, pkg);
      if (!pkgDir) {
        throw new Error(`No se encontro el paquete '${pkg}' en node_modules`);
      }

      wasmFiles = findWasmFiles(pkgDir);
      if (wasmFiles.length === 0) {
        throw new Error(`No se encontraron archivos .wasm en el paquete '${pkg}'`);
      }

      fs.cpSync(pkgDir, installDir, { recursive: true });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  if (wasmFiles.length === 0) {
    logger.warn(`No se encontraron archivos .wasm en ${name}`);
  } else {
    logger.success(`Se encontraron ${wasmFiles.length} archivo(s) .wasm`);
    for (const f of wasmFiles) {
      logger.detail(`  ${path.relative(installDir, f)}`);
    }
  }

  if (options?.saveDev) {
    updateWappConfig(name, true);
  } else {
    updateWappConfig(name, false);
  }

  return { name, wasmFiles, dir: installDir };
}
