# How-to Guides

## How to configure cross-compilation targets

wapp supports cross-compilation to multiple platforms via Zig build targets. Use the `cross:*` scripts defined in the root `package.json`:

```bash
# Linux x86_64
pnpm cross:linux-x64

# Linux ARM64
pnpm cross:linux-arm64

# Windows x86_64
pnpm cross:win-x64

# macOS x86_64
pnpm cross:mac-x64

# macOS ARM64
pnpm cross:mac-arm64

# All targets
pnpm cross:all
```

You can also pass a target directly to the linker:

```bash
wapp link --target x86_64-linux-gnu
```

## How to use watch mode

The wasm-compiler supports watch mode that automatically recompiles files on change:

```bash
# Using the CLI
wasm-compiler watch src/ -o dist

# Using the wapp orchestrator
wapp watch
```

Watch mode monitors the input directories for changes to `.wasm.ts`, `.asm.ts`, `.ts`, and `.asm` files and triggers a rebuild with a 300ms debounce.

## How to set custom Zig/Wasmtime paths

Configure custom paths for the Zig compiler or Wasmtime runtime in your `wapp.config.json`:

```json
{
  "zigPath": "/usr/local/bin/zig",
  "wasmtimePath": "/usr/local/bin/wasmtime",
  "outDir": "./dist"
}
```

Environment variables are also supported:

```bash
ZIG_PATH=/custom/zig WASMTIME_PATH=/custom/wasmtime wapp link
```

## How to enable WASI

To enable WASI (WebAssembly System Interface) support, pass the `--wasi` flag when linking:

```bash
wapp link --wasi
```

This allows your WebAssembly modules to access system interfaces like file I/O and clock operations. See the [WASI documentation](./WASI.md) for details on supported features and current limitations.

## How to use the cache

wapp uses a two-tier caching system for compilation results:

1. **Memory cache**: LRU cache with configurable max size (default: 50 entries)
2. **Disk cache**: Stored in `~/.wapp-cache/wasm-compiler/`

The cache is keyed by content hash, so recompilation is skipped when source files haven't changed. To clear the cache:

```bash
rm -rf ~/.wapp-cache
```

To configure the memory cache size, pass `maxMemoryCacheSize` in `CompileOptions`.
