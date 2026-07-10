#!/usr/bin/env node
import { Command } from 'commander';
import { glob } from 'glob';
import path from 'path';
import fs from 'fs';
import { compileWasm } from './index.js';

function isWasmTsFile(file: string): boolean {
  return file.endsWith('.wasm.ts') || file.endsWith('.asm.ts') || file.endsWith('.asm');
}

async function resolveInputFiles(inputs: string[]): Promise<string[]> {
  const files: string[] = [];
  for (const p of inputs) {
    const resolved = path.resolve(p);
    if (!fs.existsSync(resolved)) {
      throw new Error(`El archivo '${p}' no existe.`);
    }
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      const found = await glob('**/*.{wasm.ts,asm.ts,ts,asm}', { cwd: resolved, absolute: true, nodir: true });
      files.push(...found);
    } else if (stat.isFile() && (isWasmTsFile(resolved) || resolved.endsWith('.ts'))) {
      files.push(resolved);
    } else {
      throw new Error(`'${p}' no es un archivo .wasm.ts, .ts, .asm ni una carpeta.`);
    }
  }
  if (files.length === 0) {
    throw new Error('No se encontraron archivos AssemblyScript para compilar.');
  }
  return files;
}

async function buildCommand(files: string[], options: {
  outDir: string;
  release: boolean;
  runtime: string;
  optimizeLevel: string;
  shrinkLevel: string;
  sourcemap: boolean;
}): Promise<void> {
  const outDir = path.resolve(options.outDir);
  const isDev = !options.release;
  const sourceMap = options.sourcemap;

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const inputFiles = await resolveInputFiles(files);

  const results: { file: string; success: boolean; output?: string; error?: string }[] = [];

  for (const file of inputFiles) {
    const sourceCode = fs.readFileSync(file, 'utf-8');
    const relativeName = path.relative(process.cwd(), file);

    console.log(`Compilando ${relativeName}...`);

    try {
      const result = await compileWasm({
        fileName: file,
        sourceCode,
        isDev,
        sourceMap,
        runtime: options.runtime,
        optimizeLevel: parseInt(options.optimizeLevel, 10),
        shrinkLevel: options.shrinkLevel ? parseInt(options.shrinkLevel, 10) : undefined,
      });

      let baseName: string;
      if (file.endsWith('.wasm.ts')) {
        baseName = path.basename(file, '.wasm.ts');
      } else if (file.endsWith('.asm.ts')) {
        baseName = path.basename(file, '.asm.ts');
      } else {
        baseName = path.basename(file, path.extname(file));
      }

      const wasmOut = path.join(outDir, `${baseName}.wasm`);
      const dtsOut = path.join(outDir, `${baseName}.d.ts`);
      const jsOut = path.join(outDir, `${baseName}.js`);

      fs.writeFileSync(wasmOut, result.wasmBytes);
      fs.writeFileSync(dtsOut, result.dtsContent);
      fs.writeFileSync(jsOut, result.bindingsJs);

      if (result.sourceMap) {
        const mapOut = path.join(outDir, `${baseName}.wasm.map`);
        fs.writeFileSync(mapOut, result.sourceMap);
      }

      results.push({ file: relativeName, success: true, output: wasmOut });
      console.log(`  -> ${wasmOut} (${result.wasmBytes.length} bytes)`);
    } catch (err: any) {
      results.push({ file: relativeName, success: false, error: err.message });
      console.log(`  ERROR: ${err.message}`);
    }
  }

  const ok = results.filter(r => r.success).length;
  const fail = results.filter(r => !r.success).length;

  console.log(`\nResumen: ${ok} compilados, ${fail} fallos`);
  if (fail > 0) {
    for (const r of results) {
      if (!r.success) console.log(`  FAIL: ${r.file} — ${r.error}`);
    }
  }

  process.exit(fail > 0 ? 1 : 0);
}

const program = new Command();

program
  .name('wasm-compiler')
  .description('Compila archivos AssemblyScript (.wasm.ts, .ts, .asm) a WebAssembly')
  .version('1.0.0');

program
  .command('build')
  .description('Compila archivos AssemblyScript a WebAssembly')
  .argument('<files...>', 'Archivos .wasm.ts, .ts, .asm o carpetas a compilar')
  .option('-o, --outDir <dir>', 'Directorio de salida', 'wasm-out')
  .option('--release', 'Modo release (optimizado, sin sourcemaps)', false)
  .option('--runtime <name>', 'Runtime (incremental, minimal, stub, full)', 'incremental')
  .option('--optimizeLevel <n>', 'Nivel de optimización 0-3', '3')
  .option('--shrinkLevel <n>', 'Nivel de reducción 0-2')
  .option('--no-sourcemap', 'Deshabilitar sourcemaps en modo debug')
  .action(async (files: string[], options) => {
    try {
      await buildCommand(files, options);
    } catch (err) {
      console.log(`\nError: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);