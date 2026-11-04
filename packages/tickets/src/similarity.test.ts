import { describe, expect, it } from "vitest";
import { SIMILARITY_LIKELY_DUPLICATE, similarity, tokenize } from "./similarity";

describe("tokenize", () => {
  it("remove acentos, stopwords e pontuação", () => {
    expect(tokenize("Meu notebook não conecta na VPN!")).toEqual(["notebook", "conecta", "vpn"]);
  });

  it("mantém números curtos como códigos de erro", () => {
    expect(tokenize("erro 809")).toEqual(["erro", "809"]);
  });

  it("trata texto com e sem acento como igual", () => {
    expect(tokenize("Lentidão")).toEqual(tokenize("lentidao"));
  });
});

describe("similarity", () => {
  it("reconhece o mesmo problema descrito de outro jeito", () => {
    expect(similarity("Notebook muito lento", "Notebook lento após atualização do Windows"))
      .toBeGreaterThanOrEqual(SIMILARITY_LIKELY_DUPLICATE);
  });

  it("não confunde problemas diferentes da mesma categoria", () => {
    expect(similarity("VPN não conecta, erro 809", "VPN cai a cada 10 minutos"))
      .toBeLessThan(SIMILARITY_LIKELY_DUPLICATE);
  });

  it("retorna 0 quando um dos textos não tem termos relevantes", () => {
    expect(similarity("não está", "Senha do SAP bloqueada")).toBe(0);
  });
});