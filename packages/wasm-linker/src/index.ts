import { glob } from 'glob';
import path from 'path';
import fs from 'fs';
import { NativeAppOptions, LinkerError } from 'wapp-types';
import { readWasmModules } from './wasm-io.js';
import { resolveDependencies } from './linker.js';
import { generateCCode, validateEntryExport } from './codegen.js';
import { ensureWasmtimeAvailable } from './wasmtime-dl.js';
import { ensureZigAvailable } from './zig-downloader.js';
import { compileWithZig } from './compiler.js';

export async function createNativeApp(options: NativeAppOptions): Promise<void> {
  let wasmFiles: string[] = [];
  for (const p of options.inputPaths) {
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        const files = await glob('**/*.wasm', { cwd: p, absolute: true, nodir: true });
        wasmFiles.push(...files);
      } else if (stat.isFile() && p.endsWith('.wasm')) {
        wasmFiles.push(path.resolve(p));
      } else {
        throw new LinkerError(`La ruta '${p}' no es un archivo .wasm ni una carpeta.`);
      }
    } else {
      throw new LinkerError(`La ruta '${p}' no existe.`);
    }
  }

  if (wasmFiles.length === 0) {
    throw new LinkerError('No se encontraron archivos .wasm.');
  }

  console.log(`Modulos encontrados: ${wasmFiles.map(f => path.basename(f)).join(', ')}`);

  const modules = await readWasmModules(wasmFiles);

  const resolved = resolveDependencies(modules, options.moduleMatching);

  console.log('Dependencias resueltas. Orden de instanciacion:');
  resolved.order.forEach((mod, idx) => {
    console.log(`  ${idx}: ${path.basename(mod.module.fileName)} (exports: ${mod.module.exports.map(e => e.name).join(', ')})`);
  });

  validateEntryExport(resolved, options.entry);

  const cCode = generateCCode(resolved, options.entry, options.wasi);

  const buildDir = path.join(process.cwd(), '.wapp_build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }
  const cFilePath = path.join(buildDir, 'wasm_bundle.cpp');
  fs.writeFileSync(cFilePath, cCode, 'utf-8');
  console.log(`Codigo C++ generado en ${cFilePath}`);

  const zigExe = options.zigPath ? options.zigPath : await ensureZigAvailable();
  const wasmtimeLib = options.wasmtimePath
    ? { includeDir: path.join(options.wasmtimePath, 'include'), libPath: path.join(options.wasmtimePath, 'lib', getLibName()) }
    : await ensureWasmtimeAvailable();

  await compileWithZig(zigExe, {
    source: cFilePath,
    includeDir: wasmtimeLib.includeDir,
    libPath: wasmtimeLib.libPath,
    output: options.output,
    target: options.target,
    wasi: options.wasi,
  });
}

function getLibName(): string {
  return process.platform === 'win32' ? 'wasmtime.lib' : 'libwasmtime.a';
}
