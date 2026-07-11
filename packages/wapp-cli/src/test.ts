import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { glob } from 'glob';
import { logger } from 'wapp-types';
import { createNativeApp } from 'wasm-linker';
import { spawnSync } from 'node:child_process';
import pc from 'picocolors';

export interface TestOptions {
  entry?: string;
  wasmtimePath?: string;
}

export async function runTests(source: string, options: TestOptions): Promise<boolean> {
  const sourcePath = path.resolve(source);
  let wasmFiles: string[];

  if (fs.existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory()) {
    wasmFiles = glob.sync('**/*.wasm', { cwd: sourcePath, absolute: true, nodir: true });
  } else if (sourcePath.endsWith('.wasm') && fs.existsSync(sourcePath)) {
    wasmFiles = [sourcePath];
  } else {
    logger.error(`No se encontro el archivo o directorio: ${source}`);
    return false;
  }

  if (wasmFiles.length === 0) {
    logger.error(`No se encontraron archivos .wasm en ${source}`);
    return false;
  }

  logger.step(`Ejecutando tests para ${wasmFiles.length} modulo(s) WebAssembly`);

  let allPassed = true;
  let passed = 0;
  let failed = 0;

  for (const wasmFile of wasmFiles) {
    const relativeName = path.relative(process.cwd(), wasmFile);
    logger.info(`\n${pc.bold(relativeName)}`);

    const wasmBytes = fs.readFileSync(wasmFile);
    const module = new WebAssembly.Module(wasmBytes);
    const exports = WebAssembly.Module.exports(module);
    const funcExports = exports.filter(e => e.kind === 'function');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wapp-test-'));
    const outputBinary = path.join(tmpDir, 'test-output');

    try {
      logger.detail(`  Exporta ${funcExports.length} funcion(es): ${funcExports.map(e => e.name).join(', ')}`);

      const entry = options.entry ?? '_start';
      await createNativeApp({
        inputPaths: [wasmFile],
        output: outputBinary,
        entry,
        wasi: true,
        moduleMatching: 'name-only',
        wasmtimePath: options.wasmtimePath,
      });

      const binaryPath = fs.existsSync(outputBinary)
        ? outputBinary
        : fs.existsSync(outputBinary + '.exe')
          ? outputBinary + '.exe'
          : null;

      if (!binaryPath) {
        logger.error(`  ${pc.red('FAIL')} - no se genero el binario nativo`);
        failed++;
        allPassed = false;
        continue;
      }

      const result = spawnSync(binaryPath, [], { timeout: 30000 });

      if (result.status === 0) {
        logger.success(`  ${pc.green('PASS')} (exit code: ${result.status})`);
        passed++;
      } else {
        logger.error(`  ${pc.red('FAIL')} (exit code: ${result.status})`);
        if (result.stderr?.length) {
          logger.detail(`    stderr: ${result.stderr.toString().trim()}`);
        }
        if (result.stdout?.length) {
          logger.detail(`    stdout: ${result.stdout.toString().trim()}`);
        }
        failed++;
        allPassed = false;
      }
    } catch (err: any) {
      logger.error(`  ${pc.red('FAIL')} - ${err.message}`);
      failed++;
      allPassed = false;
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  const total = passed + failed;
  logger.info(`\n${pc.bold('Resultados:')} ${pc.green(`${passed} pasaron`)}, ${pc.red(`${failed} fallaron`)}, ${total} total`);

  return allPassed;
}
