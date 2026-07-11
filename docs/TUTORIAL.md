# Getting Started with wapp

This tutorial walks you through installing wapp, creating a new project, writing an AssemblyScript module, and building it into a native executable.

## Prerequisites

- Node.js 20+
- pnpm
- Zig 0.13+ (for native binary linking)

## Installing wapp

Install the CLI globally:

```bash
pnpm add -g wapp-cli
```

Or use it directly via `pnpm dlx`:

```bash
pnpm dlx wapp-cli build
```

## Creating a new project

Create a project directory and initialize:

```bash
mkdir my-wapp-project
cd my-wapp-project
wapp init
```

This creates the following structure:

```
my-wapp-project/
  src/
    main.wasm.ts
  wapp.config.json
```

## Writing a simple AssemblyScript module

Edit `src/main.wasm.ts`:

```typescript
export function greet(name: string): string {
  return "Hello, " + name + "!";
}

export function add(a: i32, b: i32): i32 {
  return a + b;
}
```

## Building to native executable

Compile the AssemblyScript to WebAssembly and link it into a native binary:

```bash
wapp build
wapp link
```

The compiled binary will be placed in `dist/`.

## Running the executable

```bash
./dist/my-wapp-project
```

You should see the program output. If your module exposes a `main` function, it will be called automatically.

## Next steps

- Check the [How-to Guide](./HOWTO.md) for cross-compilation and watch mode
- See the [API Reference](./API.md) for programmatic usage
- Read about [WASI support](./WASI.md) for system interface access
