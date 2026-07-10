# wasm-compiler

Compila archivos AssemblyScript (`.wasm.ts`, `.ts`, `.asm`) a WebAssembly usando el compilador oficial de AssemblyScript (`asc`).

## Instalación

```bash
pnpm add wasm-compiler
# o global:
pnpm add -g wasm-compiler
```

## Uso

```bash
wasm-compiler [opciones] <archivos|carpetas...>
```

Compila uno o varios archivos AssemblyScript y genera `.wasm`, `.d.ts` y `.js` por cada módulo.

## Opciones

| Opción | Descripción | Defecto |
|---|---|---|
| `-o, --outDir <dir>` | Directorio de salida | `./wasm-out` |
| `--release` | Modo release (optimizado, sin sourcemaps) | debug |
| `--runtime <name>` | Runtime: `incremental`, `minimal`, `stub`, `full` | `incremental` |
| `--optimizeLevel <n>` | Nivel de optimización 0-3 | `3` |
| `--shrinkLevel <n>` | Nivel de reducción 0-2 | `0` |
| `--no-sourcemap` | Deshabilitar sourcemaps | habilitado en debug |
| `-h, --help` | Muestra la ayuda | — |
| `-v, --version` | Muestra la versión | — |

## Argumentos de entrada

Puedes pasar archivos individuales o carpetas. Las carpetas se recorren recursivamente buscando archivos con extensión `.wasm.ts`, `.asm.ts`, `.ts` o `.asm`.

## Ejemplos

### Compilar un solo archivo

```bash
wasm-compiler -o build mi-modulo.wasm.ts
```

### Compilar una carpeta entera

```bash
wasm-compiler src/assembly/
```

### Compilar en modo release

```bash
wasm-compiler --release -o dist modulo.wasm.ts
```

### Compilar múltiples archivos con runtime stub

```bash
wasm-compiler -o out a.wasm.ts b.wasm.ts --runtime stub
```

### Compilar archivos .ts y .asm

```bash
wasm-compiler --release -o build main.ts lib.asm
```

### Compilar con optimización agresiva de tamaño

```bash
wasm-compiler --release --optimizeLevel 2 --shrinkLevel 2 -o build modulo.wasm.ts
```

## Programa vs CLI

Además de la CLI, `wasm-compiler` expone la función `compileWasm()` para uso programático:

```typescript
import { compileWasm } from 'wasm-compiler'

const result = await compileWasm({
  fileName: 'modulo.wasm.ts',
  sourceCode: 'export function add(a: i32, b: i32): i32 { return a + b }',
  isDev: true,
  runtime: 'stub',
})

// result.wasmBytes  → Uint8Array
// result.dtsContent → string (declaraciones .d.ts)
// result.bindingsJs → string (JS loader)
```

## Archivos generados

Para cada archivo de entrada `modulo.wasm.ts`, la CLI genera en `--outDir`:
- `modulo.wasm` — binario WebAssembly
- `modulo.d.ts` — declaraciones TypeScript de las exportaciones
- `modulo.js` — JS loader generado por AssemblyScript
- `modulo.wasm.map` — sourcemap (solo modo debug)

## API Programática

Además de la CLI, `wasm-compiler` expone la función `compileWasm()`:

```typescript
import { compileWasm } from 'wasm-compiler'

const result = await compileWasm({
  fileName: 'modulo.wasm.ts',
  sourceCode: 'export function add(a: i32, b: i32): i32 { return a + b }',
  isDev: true,
  runtime: 'stub',
})

// result.wasmBytes  → Uint8Array
// result.dtsContent → string (declaraciones .d.ts)
// result.bindingsJs → string (JS loader)
```

## Tests

```bash
pnpm test    # Jest
pnpm test -- --coverage
```

## Licencia

MIT