import { describe, expect, it } from "vitest";
import { ReplyStream, cleanReply, extractLeakedDecision } from "./reply";

const leaked = '{"intent":"knowledge_question","understanding":"Perguntou o horário.","action":"answer_from_kb","confidence":1,"reason":"Artigo encontrado.","rulesApplied":[]}';

describe("extractLeakedDecision", () => {
  it("separa a decisão escrita no fim do texto", () => {
    const result = extractLeakedDecision(`Atendemos das 8h às 18h. ${leaked}`);
    expect(result.text).toBe("Atendemos das 8h às 18h.");
    expect(result.decision).toMatchObject({ intent: "knowledge_question", action: "answer_from_kb" });
  });

  it("entende o bloco dentro de cerca de código", () => {
    const result = extractLeakedDecision(`Pronto.\n\`\`\`json\n${leaked}\n\`\`\``);
    expect(result.text).toBe("Pronto.");
    expect(result.decision).not.toBeNull();
  });

  it("não mexe em chaves que não são uma decisão", () => {
    const text = "Use o formato {nome}.{sobrenome}@nexo.com.br.";
    expect(extractLeakedDecision(text)).toEqual({ text, decision: null });
  });
});

describe("ReplyStream", () => {
  it("segura o texto a partir de uma chave", () => {
    const shown: string[] = [];
    const stream = new ReplyStream((d) => shown.push(d));

    stream.push("Atendemos das 8h às 18h. ");
    stream.push('{"intent":');
    stream.push('"greeting"}');

    expect(shown.join("")).toBe("Atendemos das 8h às 18h. ");
    expect(stream.raw).toContain('"greeting"');
  });

  it("libera o trecho retido quando pedido", () => {
    const shown: string[] = [];
    const stream = new ReplyStream((d) => shown.push(d));
    stream.push("Formato {nome}.");
    stream.flushHeld();
    expect(shown.join("")).toBe("Formato {nome}.");
  });
});

describe("cleanReply", () => {
  it("remove OK solto, frases repetidas e comentários sobre cards", () => {
    const text =
      "Encaminhei para o Suporte N1. Encaminhei para o Suporte N1. Confira o rascunho. (O card do rascunho foi exibido acima) OK.";
    expect(cleanReply(text)).toBe("Encaminhei para o Suporte N1. Confira o rascunho.");
  });
});