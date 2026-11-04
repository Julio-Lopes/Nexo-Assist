const STOPWORDS = new Set([
  "a", "o", "as", "os", "e", "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas",
  "um", "uma", "para", "pra", "por", "com", "sem", "que", "nao", "meu", "minha", "meus",
  "minhas", "muito", "mais", "apos", "esta", "estou", "ao", "aos", "cada", "desde", "ja",
  "ainda", "tem", "ter", "consigo", "preciso", "quando", "como",
]);

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Tokens relevantes: sem acento, sem stopwords, mantendo números como "809". */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t) && (t.length >= 3 || /^\d+$/.test(t)));
}

/** Coeficiente de Dice entre os tokens dos dois textos (0 a 1). */
export function similarity(a: string, b: string): number {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;

  return (2 * shared) / (left.size + right.size);
}

/** A partir daqui o candidato aparece para o agent avaliar. */
export const SIMILARITY_MIN = 0.3;
/** A partir daqui é provável duplicidade: o agent oferece atualizar em vez de criar. */
export const SIMILARITY_LIKELY_DUPLICATE = 0.5;