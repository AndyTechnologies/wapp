import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { glob } from 'glob';
import { logger, formatBytes } from 'wapp-types';
import { createNativeApp } from 'wasm-linker';
import { spawnSync } from 'node:child_process';
import pc from 'picocolors';

export interface BenchOptions {
  entry?: string;
  runs?: number;
}

export interface BenchResult {
  file: string;
  wasmSize: number;
  binarySize: number;
  compileTime: number;
  runTimes: number[];
  avgRunTime: number;
  minRunTime: number;
  maxRunTime: number;
}

export async function runBenchmark(source: string, options: BenchOptions): Promise<BenchResult[]> {
  const sourcePath = path.resolve(source);
  let wasmFiles: string[];

  if (fs.existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory()) {
    wasmFiles = glob.sync('**/*.wasm', { cwd: sourcePath, absolute: true, nodir: true });
  } else if (sourcePath.endsWith('.wasm') && fs.existsSync(sourcePath)) {
    wasmFiles = [sourcePath];
  } else {
    throw new Error(`No se encontro el archivo o directorio: ${source}`);
  }

  if (wasmFiles.length === 0) {
    throw new Error(`No se encontraron archivos .wasm en ${source}`);
  }

  const runs = options.runs ?? 3;
  const results: BenchResult[] = [];

  logger.step(`Ejecutando benchmarks para ${wasmFiles.length} modulo(s) (${runs} corrida(s) cada uno)`);

  for (const wasmFile of wasmFiles) {
    const relativeName = path.relative(process.cwd(), wasmFile);
    logger.info(`\n${pc.bold(relativeName)}`);

    const wasmBytes = fs.readFileSync(wasmFile);
    const wasmSize = wasmBytes.length;
    logger.detail(`  Tamano .wasm: ${formatBytes(wasmSize)}`);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wapp-bench-'));
    const outputBinary = path.join(tmpDir, 'bench-output');

    try {
      const entry = options.entry ?? '_start';

      logger.detail(`  Compilando a nativo...`);
      const compileStart = performance.now();
      await createNativeApp({
        inputPaths: [wasmFile],
        output: outputBinary,
        entry,
        wasi: true,
        moduleMatching: 'name-only',
      });
      const compileEnd = performance.now();
      const compileTime = compileEnd - compileStart;

      const binaryPath = fs.existsSync(outputBinary)
        ? outputBinary
        : fs.existsSync(outputBinary + '.exe')
          ? outputBinary + '.exe'
          : null;
      const binarySize = binaryPath ? fs.statSync(binaryPath).size : 0;
      logger.detail(`  Tamano binario: ${formatBytes(binarySize)}, compilacion: ${compileTime.toFixed(1)}ms`);

      const runTimes: number[] = [];
      for (let i = 0; i < runs; i++) {
        logger.detail(`  Ejecutando corrida ${i + 1}/${runs}...`);
        const runStart = performance.now();
        const result = spawnSync(binaryPath!, [], { timeout: 30000 });
        const runEnd = performance.now();
        const runTime = runEnd - runStart;
        runTimes.push(runTime);
        if (result.status !== 0) {
          logger.warn(`    Exit code: ${result.status}`);
        }
      }

      const avg = runTimes.reduce((a, b) => a + b, 0) / runTimes.length;
      const min = Math.min(...runTimes);
      const max = Math.max(...runTimes);

      logger.success(`  Promedio: ${avg.toFixed(1)}ms | Min: ${min.toFixed(1)}ms | Max: ${max.toFixed(1)}ms`);

      results.push({
        file: relativeName,
        wasmSize,
        binarySize,
        compileTime,
        runTimes,
        avgRunTime: avg,
        minRunTime: min,
        maxRunTime: max,
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  logger.info(`\n${pc.bold('Resumen de benchmarks:')}`);
  const header = `${'Modulo'.padEnd(30)} ${'WASM'.padEnd(10)} ${'Binario'.padEnd(10)} ${'Compile'.padEnd(10)} ${'Promedio'.padEnd(10)} ${'Min'.padEnd(10)} ${'Max'.padEnd(10)}`;
  logger.info(header);
  for (const r of results) {
    const line = `${r.file.padEnd(30)} ${formatBytes(r.wasmSize).padEnd(10)} ${formatBytes(r.binarySize).padEnd(10)} ${r.compileTime.toFixed(0).padEnd(10)} ${r.avgRunTime.toFixed(1).padEnd(10)} ${r.minRunTime.toFixed(1).padEnd(10)} ${r.maxRunTime.toFixed(1).padEnd(10)}`;
    logger.info(line);
  }

  return results;
}
