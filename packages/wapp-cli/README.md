# wapp-cli

Orquestador para compilar proyectos AssemblyScript a ejecutables nativos usando **wasm-compiler** + **wasm-linker**.

## Instalacion

```bash
pnpm add wapp-cli
pnpm add -g wapp-cli
```

## Uso

### init

Crea un archivo de configuracion `wapp.json` en el directorio actual:

```bash
wapp-cli init --entry main
```

### build

Compila AssemblyScript a WebAssembly y luego a ejecutable nativo:

```bash
wapp-cli build                    # usa wapp.json del proyecto
wapp-cli build src/               # compila desde un directorio especifico
wapp-cli build -o mi-app          # define el ejecutable de salida
wapp-cli build -e _start          # define la funcion de entrada
wapp-cli build --release          # modo release (optimizado)
wapp-cli build --wasi             # habilita WASI
wapp-cli build --target aarch64-macos  # cross-compilacion
```

## Configuracion (`wapp.json`)

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

## Cross-compilation

```bash
wapp-cli build -t x86_64-linux-gnu   # Linux x86_64
wapp-cli build -t aarch64-macos       # macOS ARM
wapp-cli build -t x86_64-windows-gnu  # Windows
```

## Tests

```bash
pnpm test    # Jest
pnpm test -- --coverage
```

## Ejemplo completo

```bash
# Inicializar proyecto
wapp-cli init --entry main --wasi

# Crear modulo AssemblyScript
mkdir -p src/assembly
cat > src/assembly/index.wasm.ts << 'EOF'
export function main(): i32 {
  return 42;
}
EOF

# Compilar a ejecutable nativo
wapp-cli build
./build/output
```