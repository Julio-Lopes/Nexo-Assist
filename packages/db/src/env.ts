/** Carrega o .env da raiz em desenvolvimento. Em produção as variáveis vêm do ambiente. */
export function loadLocalEnv(): void {
  try {
    process.loadEnvFile("../../.env");
  } catch {
    // arquivo ausente: segue com process.env
  }
}

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida");
  return url;
}

export function isLocalDatabase(url: string): boolean {
  return /@(localhost|127\.0\.0\.1|db)(:\d+)?\//.test(url);
}