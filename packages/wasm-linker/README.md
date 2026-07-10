# wasm-linker

Convierte modulos WebAssembly (`.wasm`) en ejecutables nativos usando **C++**, **Wasmtime** y **zig c++**.

## Instalacion

```bash
pnpm add wasm-linker
pnpm add -g wasm-linker
```

## Uso

```bash
wasm-linker build modulos/*.wasm -o mi-app
wasm-linker build ruta/carpeta -o app --entry main
wasm-linker build a.wasm b.wasm c.wasm -o app --target x86_64-linux-gnu
```

## Comandos

### `build`

Compila modulos `.wasm` en un ejecutable nativo autocontenido:

```
wasm-linker build <input> -o <output> [opciones]
```

| Opcion | Descripcion |
|--------|-------------|
| `-o, --output <file>` | Ruta del ejecutable de salida (requerido) |
| `-t, --target <triple>` | Tripleta de compilacion (ej. `x86_64-linux-gnu`) |
| `-e, --entry <name>` | Funcion exportada a llamar (defecto: `_start`) |
| `--wasi` | Habilitar interfaz WASI |
| `--module-matching <strategy>` | `name-only` (defecto) o `file-name` |
| `--zig-path <path>` | Ruta personalizada a zig |
| `--wasmtime-path <path>` | Ruta personalizada a Wasmtime C API |

### setup

Descarga las dependencias (Zig + Wasmtime):

```
wasm-linker setup
wasm-linker setup --ignore-cache
```

### cache

Gestiona la cache de descargas:

```
wasm-linker cache info
wasm-linker cache clear
```

### status

Muestra el estado de las dependencias:

```
wasm-linker status
```

## Ejemplos

Compilar un modulo simple:

```bash
wasm-linker build modulo.wasm -o app --entry main
```

Con varios modulos que se importan entre si:

```bash
wasm-linker build app.wasm lib.wasm -o server --entry handle_request --wasi
```

Cross-compilacion desde macOS x86_64 a macOS ARM64:

```bash
wasm-linker build mod.wasm -o app --target aarch64-macos
```

## Cross-compilation

Compila para cualquier plataforma soportada por Zig usando `--target`:

```bash
wasm-linker build modulo.wasm -o app --target x86_64-linux-gnu   # Linux x86_64
wasm-linker build modulo.wasm -o app --target aarch64-linux-gnu  # Linux ARM64
wasm-linker build modulo.wasm -o app --target x86_64-windows-gnu # Windows x86_64
wasm-linker build modulo.wasm -o app --target x86_64-macos       # macOS Intel
wasm-linker build modulo.wasm -o app --target aarch64-macos      # macOS Apple Silicon
```

Los scripts `cross:*` del monorepo envuelven estos comandos para usarlos desde la raíz:

```bash
pnpm cross:linux-x64 -- modulo.wasm -o app
pnpm cross:all          # compila para las 5 plataformas
```

## Tests

```bash
pnpm test    # Jest
pnpm test -- --coverage
```

## Almacenamiento

La cache de descargas se almacena en `~/.wasm-linker/` (o `~/.wapp/` por compatibilidad).