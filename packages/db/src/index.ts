export * from "./schema";
export * from "./client";
export { isLocalDatabase } from "./env";

// Reexporta os operadores para que todos os pacotes usem a mesma instância do drizzle-orm.
export { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";