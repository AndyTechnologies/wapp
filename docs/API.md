# API Reference

## `compileWasm(options)`

Compiles AssemblyScript source code to WebAssembly.

**Package**: `wasm-compiler`  
**Import**: `import { compileWasm } from 'wasm-compiler'`

**Parameters**: `CompileOptions`

| Option              | Type       | Default          | Description                              |
|---------------------|------------|------------------|------------------------------------------|
| `fileName`          | `string`   | `''`             | Source file name (used for caching)      |
| `sourceCode`        | `string`   | `''`             | AssemblyScript source code               |
| `maxMemoryCacheSize`| `number`   | `50`             | Max entries in memory LRU cache          |
| `ext`               | `string`   | `'.wasm.ts'`     | File extension hint                      |
| `isDev`             | `boolean`  | `true`           | Debug mode (sourcemaps, no optimize)     |
| `runtime`           | `string`   | `'incremental'`  | AS runtime (`incremental`, `minimal`, `stub`, `full`) |
| `sourceMap`         | `boolean`  | `true`           | Generate source maps (dev only)          |
| `optimizeLevel`     | `number`   | `3`              | Optimization level 0-3 (release only)    |
| `shrinkLevel`       | `number`   | `undefined`      | Shrink level 0-2 (release only)          |
| `aliases`           | `ResolvedAlias[]` | `[]`        | Import path aliases                      |

**Returns**: `Promise<CompileResult>`

| Field         | Type         | Description                     |
|---------------|--------------|---------------------------------|
| `wasmBytes`   | `Uint8Array` | Compiled WebAssembly binary     |
| `dtsContent`  | `string`     | TypeScript declaration file     |
| `bindingsJs`  | `string`     | JavaScript bindings file        |
| `sourceMap`   | `string`     | Source map (dev mode only)      |
| `dependencies`| `string[]`   | File dependencies               |
| `hash`        | `string`     | SHA-256 content hash            |

**Throws**: `CompilerError` on compilation failure.

## `createNativeApp(options)`

Links compiled WebAssembly modules into a native executable.

**Package**: `wasm-linker`  
**Import**: `import { createNativeApp } from 'wasm-linker'`

| Option       | Type       | Default   | Description                          |
|--------------|------------|-----------|--------------------------------------|
| `modules`    | `string[]` | required  | Paths to `.wasm` files               |
| `outDir`     | `string`   | `'dist'`  | Output directory                     |
| `target`     | `string`   | host      | Zig cross-compilation target         |
| `wasi`       | `boolean`  | `false`   | Enable WASI support                  |

**Returns**: `Promise<string>` — path to the generated native binary.

## `WappConfig`

Configuration structure used by the CLI.

```typescript
interface WappConfig {
  /** Input source directory */
  srcDir?: string;
  /** Output directory for compiled artifacts */
  outDir?: string;
  /** Path to Zig compiler */
  zigPath?: string;
  /** Path to Wasmtime runtime */
  wasmtimePath?: string;
  /** Enable WASI support */
  wasi?: boolean;
  /** Cross-compilation target */
  target?: string;
  /** AssemblyScript runtime */
  runtime?: 'incremental' | 'minimal' | 'stub' | 'full';
  /** Development mode */
  dev?: boolean;
}
```

## CLI Commands

### `wapp init`

Scaffolds a new wapp project.

```
wapp init [directory]
```

### `wapp build`

Compiles AssemblyScript files to WebAssembly.

```
wapp build [files...] [options]
```

| Option              | Default          | Description                    |
|---------------------|------------------|--------------------------------|
| `-o, --outDir`      | `wasm-out`       | Output directory               |
| `--release`         | `false`          | Production build (optimized)   |
| `--runtime`         | `incremental`    | AS runtime variant             |
| `--optimizeLevel`   | `3`              | Optimization level             |
| `--shrinkLevel`     | —                | Shrink level                   |
| `--no-sourcemap`    | —                | Disable source maps            |
| `--no-parallel`     | —                | Disable parallel compilation   |

### `wapp watch`

Watches files and recompiles on change.

```
wapp watch [files...] [options]
```

Same options as `wapp build`.

### `wapp link`

Links WebAssembly modules into a native executable.

```
wapp link [options]
```

| Option               | Default  | Description                     |
|----------------------|----------|---------------------------------|
| `--wasi`             | `false`  | Enable WASI support             |
| `--target`           | host     | Cross-compilation target        |
| `-o, --outDir`       | `dist`   | Output directory                |

### `wasm-compiler`

Standalone compiler CLI (aliased as `wapp build`).

```
wasm-compiler build [files...] [options]
wasm-compiler watch [files...] [options]
```
