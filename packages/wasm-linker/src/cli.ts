#!/usr/bin/env node
import { Command } from 'commander';
import { createNativeApp } from './index.js';
import { runSetup, checkSetupStatus } from './setup.js';
import { clearCache, getCacheInfo } from './cache.js';

const program = new Command();

program
  .name('wasm-linker')
  .description('Convierte proyectos WebAssembly en ejecutables nativos autocontenidos')
  .version('1.0.0');

// ── build ──────────────────────────────────────────────────
program
  .command('build')
  .description('Compila uno o varios archivos .wasm en un ejecutable nativo')
  .argument('<input>', 'Carpeta o archivos .wasm (múltiples separados por espacio)')
  .requiredOption('-o, --output <file>', 'Nombre del ejecutable de salida')
  .option('-t, --target <triple>', 'Tripleta de compilación (ej. x86_64-linux-gnu, aarch64-macos)')
  .option('-e, --entry <name>', 'Punto de entrada (función exportada, por defecto _start)', '_start')
  .option('--wasi', 'Habilitar interfaz WASI', false)
  .option('--module-matching <strategy>', 'Estrategia de resolución: name-only (defecto) o file-name', 'name-only')
  .option('--zig-path <path>', 'Ruta personalizada al ejecutable de zig')
  .option('--wasmtime-path <path>', 'Ruta personalizada a la API C de Wasmtime (include/lib)')
  .action(async (input: string, options) => {
    try {
      await createNativeApp({
        inputPaths: input.split(' '),
        output: options.output,
        target: options.target,
        entry: options.entry,
        wasi: options.wasi,
        moduleMatching: options.moduleMatching as 'name-only' | 'file-name',
        zigPath: options.zigPath,
        wasmtimePath: options.wasmtimePath,
      });
      console.log(`Ejecutable creado: ${options.output}`);
    } catch (err: any) {
      console.error(`\nError: ${err.message}`);
      process.exit(1);
    }
  });

// ── setup ──────────────────────────────────────────────────
program
  .command('setup')
  .description('Descarga y verifica las dependencias necesarias (Zig + Wasmtime)')
  .option('--ignore-cache', 'Ignora la caché y fuerza la descarga completa', false)
  .action(async (options) => {
    try {
      await runSetup({ ignoreCache: options.ignoreCache });
    } catch (err: any) {
      console.error(`\nError en setup: ${err.message}`);
      if (err.stack) {
        console.error(`\n${err.stack}`);
      }
      process.exit(1);
    }
  });

// ── cache ──────────────────────────────────────────────────
const cacheCmd = program
  .command('cache')
  .description('Gestiona la caché de descargas de Wapp');

cacheCmd
  .command('info')
  .description('Muestra información de la caché')
  .action(async () => {
    const info = await getCacheInfo();
    if (!info.exists) {
      console.log('No hay caché de descargas.');
      return;
    }
    console.log(`Ruta: ${info.path}`);
    console.log(`Tamaño: ${info.humanSize} (${info.size} bytes)`);
    console.log('Contenido:');
    for (const entry of info.entries) {
      console.log(`  ${entry}`);
    }
  });

cacheCmd
  .command('clear')
  .description('Elimina toda la caché de descargas')
  .action(async () => {
    await clearCache();
  });

// ── status (alias rápido de "setup" en modo check) ────────
program
  .command('status')
  .description('Muestra el estado de las dependencias')
  .action(async () => {
    try {
      const status = await checkSetupStatus();
      console.log('\nEstado de dependencias:\n');
      console.log(`Zig:      ${status.zig.status === 'ok' ? 'OK' : 'FALTA'} ${status.zig.path ? `(${status.zig.path})` : ''}${status.zig.error ? ` - ${status.zig.error}` : ''}`);
      console.log(`Wasmtime: ${status.wasmtime.status === 'ok' ? 'OK' : 'FALTA'} ${status.wasmtime.path ? `(${status.wasmtime.path})` : ''}${status.wasmtime.error ? ` - ${status.wasmtime.error}` : ''}`);
      console.log(`Caché:    ${status.cacheSize}`);
    } catch (err: any) {
      console.error(`\nError: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
