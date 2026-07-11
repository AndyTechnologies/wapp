#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { compileWasm } from 'wasm-compiler';
import { createNativeApp } from 'wasm-linker';
import { loadConfig, findConfig, writeConfig, resolveSourceFiles, isAssemblyScriptFile } from './config.js';
import { installPackage } from './install.js';
import { runTests } from './test.js';
import { runBenchmark } from './bench.js';
import type { WappConfig, CrossCompileTarget } from 'wapp-types';
import { ConfigError, logger } from 'wapp-types';
import pc from 'picocolors';

const MIN_NODE_MAJOR = 18;
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor < MIN_NODE_MAJOR) {
  logger.error(`Error: wapp requiere Node.js v${MIN_NODE_MAJOR}+ (actual: ${process.version})`);
  process.exit(1);
}

const program = new Command();

program
  .name('wapp-cli')
  .description('Orquestador para compilar proyectos AssemblyScript a ejecutables nativos')
  .version('1.0.0');

program
  .command('init')
  .description('Crea un archivo de configuracion wapp.json en el directorio actual')
  .option('--sourceDir <dir>', 'Directorio de codigo fuente AssemblyScript', 'src/assembly')
  .option('--outDir <dir>', 'Directorio de salida para el ejecutable', 'build')
  .option('--entry <name>', 'Funcion de entrada', '_start')
  .option('--wasi', 'Habilitar interfaz WASI', false)
  .option('--release', 'Modo release (optimizado)', false)
  .option('--targets <json>', 'Configuracion de targets de cross-compilacion (JSON)')
  .action((options) => {
    const configPath = path.resolve('wapp.json');
    if (fs.existsSync(configPath)) {
      logger.error('Ya existe un archivo wapp.json en este directorio.');
      process.exit(1);
    }

    const config: WappConfig = {
      sourceDir: options.sourceDir,
      outDir: options.outDir,
      entry: options.entry,
      wasi: options.wasi,
      compiler: {
        release: options.release,
      },
    };

    if (options.targets) {
      try {
        config.targets = JSON.parse(options.targets) as CrossCompileTarget[];
      } catch {
        throw new ConfigError('El parametro --targets debe ser un JSON valido.');
      }
    }

    writeConfig(config, configPath);
    logger.success(`Configuracion creada en ${configPath}`);
  });

program
  .command('build')
  .description('Compila AssemblyScript a WebAssembly y luego a ejecutable nativo')
  .argument('[source]', 'Archivo o directorio de entrada (sobrescribe sourceDir del config)')
  .option('-o, --output <file>', 'Ruta del ejecutable de salida (sobrescribe outDir)')
  .option('-e, --entry <name>', 'Funcion de entrada')
  .option('-t, --target <triple>', 'Tripleta de compilacion (ej. x86_64-linux-gnu)')
  .option('--target-name <name>', 'Nombre del target en la configuracion multi-target')
  .option('--release', 'Modo release (optimizado, sin sourcemaps)')
  .option('--wasi', 'Habilitar interfaz WASI')
  .option('--runtime <name>', 'Runtime AssemblyScript (incremental, minimal, stub, full)')
  .option('--no-sourcemap', 'Deshabilitar sourcemaps en modo debug')
  .option('--module-matching <strategy>', 'Estrategia de resolucion: name-only o file-name')
  .option('--optimizeLevel <n>', 'Nivel de optimizacion 0-3')
  .option('--shrinkLevel <n>', 'Nivel de reduccion 0-2')
  .option('--zig-path <path>', 'Ruta personalizada al ejecutable de zig')
  .option('--wasmtime-path <path>', 'Ruta personalizada a la API C de Wasmtime')
  .option('--all-targets', 'Compila para todos los targets definidos en la configuracion', false)
  .action(async (source, options) => {
    try {
      await buildCommand(source, options);
    } catch (err: any) {
      logger.error(`\nError: ${err.message}`);
      process.exit(1);
    }
  });

async function buildForTarget(
  config: WappConfig,
  projectRoot: string,
  sourceDir: string,
  wasmFiles: string[],
  targetConfig: { target?: string; output?: string; entry?: string; wasi?: boolean },
  options: Record<string, any>,
): Promise<void> {
  const output = targetConfig.output
    ? path.resolve(projectRoot, targetConfig.output)
    : options.output
      ? path.resolve(projectRoot, options.output)
      : path.resolve(projectRoot, config.outDir!, 'output');

  const outputDir = path.dirname(output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const entry = targetConfig.entry ?? options.entry ?? config.entry ?? '_start';
  const wasi = targetConfig.wasi ?? options.wasi ?? config.wasi ?? false;

  logger.info(`\nCompilando ${wasmFiles.length} modulo(s) .wasm -> nativo (target: ${targetConfig.target || 'nativo'})...`);

  await createNativeApp({
    inputPaths: wasmFiles,
    output,
    target: targetConfig.target ?? options.target ?? config.target,
    entry,
    wasi,
    moduleMatching: (options.moduleMatching ?? config.moduleMatching ?? 'name-only') as any,
    zigPath: options.zigPath ?? config.zigPath,
    wasmtimePath: options.wasmtimePath ?? config.wasmtimePath,
  });

  logger.success(`Ejecutable creado: ${output}`);
}

async function buildCommand(source: string | undefined, options: Record<string, any>): Promise<void> {
  process.on('SIGINT', () => { logger.info('\nDeteniendo...'); process.exit(0); });
  process.on('SIGTERM', () => { logger.info('\nDeteniendo...'); process.exit(0); });

  const config = loadConfig();
  const projectRoot = process.cwd();

  const sourceDir = source
    ? path.resolve(projectRoot, source)
    : path.resolve(projectRoot, config.sourceDir!);

  const asFiles = resolveSourceFiles(sourceDir);
  if (asFiles.length === 0) {
    throw new Error(`No se encontraron archivos AssemblyScript en '${sourceDir}'.`);
  }

  logger.info(`Archivos AssemblyScript encontrados: ${asFiles.length}`);
  for (const f of asFiles) {
    logger.detail(`  ${path.relative(projectRoot, f)}`);
  }

  const wasmDir = path.join(projectRoot, '.wapp-cli', 'wasm');
  if (!fs.existsSync(wasmDir)) {
    fs.mkdirSync(wasmDir, { recursive: true });
  }

  const compilerCfg = { ...config.compiler };
  const isRelease = options.release ?? compilerCfg.release ?? false;
  const sourceMap = options.sourcemap !== false && compilerCfg.sourceMap !== false;
  const runtime = options.runtime ?? compilerCfg.runtime ?? 'incremental';
  const optimizeLevel = options.optimizeLevel !== undefined ? parseInt(options.optimizeLevel, 10) : compilerCfg.optimizeLevel;
  const shrinkLevel = options.shrinkLevel !== undefined ? parseInt(options.shrinkLevel, 10) : compilerCfg.shrinkLevel;

  const wasmFiles: string[] = [];

  for (const file of asFiles) {
    if (isAssemblyScriptFile(file)) {
      const sourceCode = fs.readFileSync(file, 'utf-8');
      const relativeName = path.relative(projectRoot, file);

      logger.step(`\nCompilando ${relativeName} a WebAssembly...`);

      const result = await compileWasm({
        fileName: file,
        sourceCode,
        isDev: !isRelease,
        sourceMap,
        runtime: runtime as any,
        optimizeLevel,
        shrinkLevel,
      });

      let baseName: string;
      if (file.endsWith('.wasm.ts')) {
        baseName = path.basename(file, '.wasm.ts');
      } else if (file.endsWith('.asm.ts')) {
        baseName = path.basename(file, '.asm.ts');
      } else {
        baseName = path.basename(file, path.extname(file));
      }

      const wasmOut = path.join(wasmDir, `${baseName}.wasm`);
      const dtsOut = path.join(wasmDir, `${baseName}.d.ts`);
      const jsOut = path.join(wasmDir, `${baseName}.js`);

      fs.writeFileSync(wasmOut, result.wasmBytes);
      fs.writeFileSync(dtsOut, result.dtsContent);
      fs.writeFileSync(jsOut, result.bindingsJs);

      if (result.sourceMap) {
        fs.writeFileSync(path.join(wasmDir, `${baseName}.wasm.map`), result.sourceMap);
      }

      wasmFiles.push(wasmOut);
      logger.success(`  -> ${path.relative(projectRoot, wasmOut)} (${result.wasmBytes.length} bytes)`);
    } else if (file.endsWith('.wasm')) {
      const relativeName = path.relative(projectRoot, file);
      const targetPath = path.join(wasmDir, path.basename(file));
      fs.copyFileSync(file, targetPath);
      wasmFiles.push(targetPath);
      logger.info(`  ${relativeName} -> ${path.relative(projectRoot, targetPath)}`);
    }
  }

  if (config.targets && config.targets.length > 0 && (options.allTargets || options.targetName)) {
    const targetsToBuild = options.targetName
      ? config.targets.filter((t: CrossCompileTarget) => t.name === options.targetName)
      : options.allTargets
        ? config.targets
        : [];

    if (targetsToBuild.length === 0 && options.targetName) {
      throw new Error(`Target '${options.targetName}' no encontrado en la configuracion.`);
    }

    for (const t of targetsToBuild) {
      await buildForTarget(config, projectRoot, sourceDir, wasmFiles, {
        target: t.triple,
        output: t.output,
        entry: t.entry,
        wasi: t.wasi,
      }, options);
    }
  } else if (options.target) {
    await buildForTarget(config, projectRoot, sourceDir, wasmFiles, {
      target: options.target,
      output: options.output,
      entry: options.entry,
      wasi: options.wasi,
    }, options);
  } else {
    await buildForTarget(config, projectRoot, sourceDir, wasmFiles, {
      output: options.output,
      entry: options.entry,
      wasi: options.wasi,
    }, options);
  }
}

program
  .command('install')
  .description('Instala un modulo WebAssembly desde npm o un repositorio git')
  .argument('<package>', 'Nombre del paquete npm o URL git')
  .option('--save-dev', 'Guardar como dependencia de desarrollo', false)
  .option('--dir <dir>', 'Directorio de modulos instalados', 'wasm_modules')
  .action(async (pkg, options) => {
    try {
      const result = await installPackage(pkg, options.dir, { saveDev: options.saveDev });
      logger.success(`\nModulo instalado en ${pc.cyan(result.dir)}`);
    } catch (err: any) {
      logger.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Ejecuta los tests de un modulo WebAssembly')
  .argument('[source]', 'Archivo .wasm o directorio', '.')
  .option('--entry <name>', 'Funcion de entrada para test', 'test')
  .option('--wasmtime-path <path>', 'Ruta personalizada a Wasmtime')
  .action(async (source, options) => {
    try {
      const ok = await runTests(source, { entry: options.entry, wasmtimePath: options.wasmtimePath });
      if (!ok) process.exit(1);
    } catch (err: any) {
      logger.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('bench')
  .description('Ejecuta benchmarks de compilacion y ejecucion')
  .argument('[source]', 'Archivo .wasm o directorio', '.')
  .option('--entry <name>', 'Funcion de entrada', '_start')
  .option('--runs <n>', 'Cantidad de ejecuciones', '3')
  .action(async (source, options) => {
    try {
      await runBenchmark(source, { entry: options.entry, runs: parseInt(options.runs, 10) });
    } catch (err: any) {
      logger.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
