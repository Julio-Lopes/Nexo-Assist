import { describe, expect, it } from "vitest";
import { ReplyStream, cleanReply, extractLeakedDecision, splitJsonBlocks } from "./reply";

const leaked =
  '{"intent":"knowledge_question","understanding":"Perguntou o horário.","action":"answer_from_kb","confidence":1,"reason":"Artigo encontrado.","rulesApplied":[]}';

describe("splitJsonBlocks", () => {
  it("remove JSON que não é decisão, inclusive malformado", () => {
    const raw =
      'O prazo passou. { "ticket": { "id": "INC-20311", "overdue": true } } { "question": "Como deseja prosseguir?", "options": }';
    expect(splitJsonBlocks(raw).text).toBe("O prazo passou.");
  });

  it("remove JSON que ficou sem fechar", () => {
    expect(splitJsonBlocks('Confira abaixo. {"options": ["Sim", "Não"').text).toBe("Confira abaixo.");
  });

  it("respeita chaves dentro de strings", () => {
    const { text, blocks } = splitJsonBlocks('Ok. {"texto": "use {nome}"} fim.');
    expect(text).toBe("Ok. fim.");
    expect(blocks).toHaveLength(1);
  });

  it("não mexe em chaves que não são JSON", () => {
    const text = "Use o formato {nome}.{sobrenome}@nexo.com.br.";
    expect(splitJsonBlocks(text).text).toBe(text);
  });
});

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
});

describe("ReplyStream", () => {
  it("nunca mostra o JSON retido", () => {
    const shown: string[] = [];
    const stream = new ReplyStream((d) => shown.push(d));

    stream.push("O prazo passou. ");
    stream.push('{"ticket": {"id": "INC-20311"}}');
    stream.push(" Como prefere seguir?");
    stream.finish(extractLeakedDecision(stream.raw).text);

    expect(shown.join("")).toBe("O prazo passou. Como prefere seguir?");
  });

  it("libera chaves comuns no fim", () => {
    const shown: string[] = [];
    const stream = new ReplyStream((d) => shown.push(d));
    stream.push("Formato {nome}.");
    stream.finish(extractLeakedDecision(stream.raw).text);
    expect(shown.join("")).toBe("Formato {nome}.");
  });
});

describe("cleanReply", () => {
  it("remove OK solto, frases repetidas e comentários sobre cards", () => {
    const text =
      "Encaminhei para o Suporte N1. Encaminhei para o Suporte N1. Confira o rascunho. (O card do rascunho foi exibido acima) OK.";
    expect(cleanReply(text)).toBe("Encaminhei para o Suporte N1. Confira o rascunho.");
  });

  it("remove trechos entre colchetes", () => {
    expect(cleanReply("Confira abaixo. [D-381: Reabertura de INC-20150 - Senha do SAP bloqueada]")).toBe("Confira abaixo.");
  });
});