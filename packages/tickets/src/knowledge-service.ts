import { eq, kbArticles, type Database } from "@nexo/db";
import { tokenize } from "./similarity";

export interface KbArticleView {
  id: string;
  title: string;
  body: string;
  tags: string[];
}

export interface KbSearchResult {
  article: KbArticleView;
  score: number;
  /** Termos que casaram: entram na trilha de decisão do agent. */
  matched: string[];
}

const WEIGHTS = { tag: 3, title: 2, body: 1 } as const;

interface IndexedArticle {
  article: KbArticleView;
  tagTokens: Set<string>;
  titleTokens: Set<string>;
  bodyTokens: Set<string>;
}

/**
 * Busca por termos com pesos. Com poucos artigos é rápida e explicável;
 * numa base grande seria trocada por full-text search ou embeddings.
 */
export class KnowledgeService {
  private cache: { loadedAt: number; items: IndexedArticle[] } | null = null;

  constructor(
    private readonly db: Database,
    private readonly ttlMs = 60_000,
  ) {}

  async getById(id: string): Promise<KbArticleView | null> {
    const [row] = await this.db.select().from(kbArticles).where(eq(kbArticles.id, id)).limit(1);
    return row ? { id: row.id, title: row.title, body: row.body, tags: row.tags } : null;
  }

  async search(query: string, limit = 3): Promise<KbSearchResult[]> {
    const terms = new Set(tokenize(query));
    if (terms.size === 0) return [];

    const items = await this.load();

    return items
      .map(({ article, tagTokens, titleTokens, bodyTokens }) => {
        let score = 0;
        const matched: string[] = [];

        for (const term of terms) {
          let hit = 0;
          if (tagTokens.has(term)) hit += WEIGHTS.tag;
          if (titleTokens.has(term)) hit += WEIGHTS.title;
          if (bodyTokens.has(term)) hit += WEIGHTS.body;
          if (hit > 0) {
            score += hit;
            matched.push(term);
          }
        }

        return { article, score, matched };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private async load(): Promise<IndexedArticle[]> {
    if (this.cache && Date.now() - this.cache.loadedAt < this.ttlMs) return this.cache.items;

    const rows = await this.db.select().from(kbArticles);
    const items = rows.map((row) => ({
      article: { id: row.id, title: row.title, body: row.body, tags: row.tags },
      tagTokens: new Set(tokenize(row.tags.join(" "))),
      titleTokens: new Set(tokenize(row.title)),
      bodyTokens: new Set(tokenize(row.body)),
    }));

    this.cache = { loadedAt: Date.now(), items };
    return items;
  }
}