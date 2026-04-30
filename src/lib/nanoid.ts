// Tiny custom-alphabet ID generator — drop-in replacement for nanoid's customAlphabet
// to avoid pulling the full package into the webapp. Cryptographically random.
import crypto from "node:crypto";

export function customAlphabet(alphabet: string, defaultSize: number) {
  return (size: number = defaultSize): string => {
    const bytes = crypto.randomBytes(size);
    let id = "";
    for (let i = 0; i < size; i++) {
      id += alphabet[bytes[i]! % alphabet.length];
    }
    return id;
  };
}
