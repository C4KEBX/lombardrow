/**
 * Pronunciation dictionary: a written token (without surrounding punctuation) and what the voice
 * should say instead. Captions keep the written form. Add an entry when the voice misreads a name.
 */
export const PRONUNCIATIONS: Readonly<Record<string, string>> = {
  "&": "and",
  vs: "versus",
  "e.g": "for example",
  "i.e": "that is",
};
