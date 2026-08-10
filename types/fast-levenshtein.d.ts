declare module 'fast-levenshtein' {
  export function get(a: string, b: string): number
  export function getSlow(a: string, b: string): number
}
