# wapp

**wapp** es una cadena de herramientas que convierte código **AssemblyScript** y módulos **WebAssembly** precompilados en **ejecutables nativos autónomos**.

Pipeline: `AssemblyScript → .wasm → C++ (Wasmtime) → ejecutable nativo`

## Arquitectura

```
┌──────────────────────────────────────────────────────────┐
│                       wapp                               │
│                                                          │
│  ┌─────────────────┐   ┌────────────────┐   ┌─────────┐  │
│  │   wapp-cli      │──>│ wasm-compiler   │   │wasm-    │  │
│  │  (orquestador)  │   │ (AS → .wasm)    │   │linker   │  │
│  │                 │   │                 │   │(.wasm→  │  │
│  │ init + build    │   │ compileWasm()   │   │  native)│  │
│  └─────────────────┘   └────────────────┘   └─────────┘  │
│                                                          │
│              ↓                                        ↓  │
│         .wasm.ts → .wasm          .wasm → ejecutable     │
└──────────────────────────────────────────────────────────┘
```

### Paquetes

| Paquete | Descripción |
|---|---|
| [`wasm-compiler`](./packages/wasm-compiler) | Compila AssemblyScript (`.wasm.ts`, `.ts`, `.asm`) a WebAssembly usando `asc` |
| [`wasm-linker`](./packages/wasm-linker) | Convierte módulos `.wasm` en ejecutables nativos via Wasmtime C-API + `zig c++` |
| [`wapp-cli`](./packages/wapp-cli) | Orquestador unificado: compila AS y linkea a nativo en un solo comando |

## Requisitos

- **Node.js** >= 20
- **pnpm** >= 9 (`npm install -g pnpm`)
- **Zig** y **Wasmtime** se descargan automáticamente con `wapp-cli setup`

## Instalación

```bash
pnpm install
pnpm build
```

## Uso rápido

```bash
# 1. Inicializar proyecto
pnpm wapp-cli init --entry main

# 2. Crear un módulo AssemblyScript
mkdir -p src/assembly
cat > src/assembly/index.wasm.ts << 'EOF'
export function main(): i32 {
  return 42;
}
EOF

# 3. Compilar a ejecutable nativo
pnpm wapp-cli build

# 4. Ejecutar
./build/output
```

## Scripts disponibles

| Script | Descripción |
|---|---|
| `pnpm build` | Compila todos los paquetes TypeScript |
| `pnpm test` | Ejecuta tests con Jest en todos los paquetes |
| `pnpm clean` | Limpia `dist/` y `node_modules/` |
| `pnpm wapp-cli` | Ejecuta el CLI orquestador |
| `pnpm wasm-linker` | Ejecuta el CLI del linker |
| `pnpm wasm-compiler` | Ejecuta el CLI del compilador |

### Cross-compilation

Compila para diferentes plataformas desde una sola máquina gracias a Zig:

| Script | Target |
|---|---|
| `pnpm cross:linux-x64` | `x86_64-linux-gnu` |
| `pnpm cross:linux-arm64` | `aarch64-linux-gnu` |
| `pnpm cross:win-x64` | `x86_64-windows-gnu` |
| `pnpm cross:mac-x64` | `x86_64-macos` |
| `pnpm cross:mac-arm64` | `aarch64-macos` |
| `pnpm cross:all` | Todas las plataformas anteriores |

Uso: `pnpm cross:linux-x64 -- build/mod.wasm -o app`

## Configuración (`wapp.json`)

```json
{
  "sourceDir": "src/assembly",
  "outDir": "build",
  "entry": "_start",
  "wasi": false,
  "moduleMatching": "name-only",
  "target": "native",
  "compiler": {
    "release": false,
    "runtime": "incremental",
    "optimizeLevel": 3,
    "sourceMap": true
  }
}
```

## Desarrollo

### Estructura del proyecto

```
wapp/
├── packages/
│   ├── wasm-compiler/     # Compilador AS → .wasm
│   ├── wasm-linker/       # Linker .wasm → nativo
│   └── wapp-cli/          # CLI orquestador
├── dist/                  # Build unificado (generado)
├── package.json           # Monorepo root
├── pnpm-workspace.yaml    # Configuración workspace
└── README.md
```

### Testing

```bash
pnpm test          # Tests en todos los paquetes
pnpm -r test       # Tests por paquete
pnpm --filter wasm-linker test  # Tests de un paquete específico
```

Los tests usan **Jest** con `ts-jest`. Cada paquete tiene su configuración en `package.json`.

### CI/CD

El proyecto usa GitHub Actions. En cada push/PR se ejecuta:

1. `pnpm install --frozen-lockfile`
2. `pnpm build`
3. `pnpm test`

Matriz: **ubuntu**, **macos**, **windows** × **Node.js 20**, **22**.

## Licencia

MIT
