// Modulo helper de cadenas para el ejemplo de dependencias
export function greet(name: string): string {
  return "Hello, " + name + "!";
}

export function stringLength(s: string): i32 {
  return s.length;
}