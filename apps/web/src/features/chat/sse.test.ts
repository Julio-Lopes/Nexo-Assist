import { describe, expect, it } from "vitest";
import { readSse } from "./sse";

function responseFrom(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream);
}

async function collect(response: Response) {
  const events = [];
  for await (const event of readSse(response)) events.push(event);
  return events;
}

describe("readSse", () => {
  it("monta eventos que chegam quebrados entre pedaços", async () => {
    const events = await collect(
      responseFrom(['event: text\ndata: {"type":"te', 'xt","delta":"Olá"}\n\nevent: done\ndata: {"type":"done"}\n\n']),
    );
    expect(events).toEqual([{ type: "text", delta: "Olá" }, { type: "done" }]);
  });

  it("aceita quebras de linha CRLF", async () => {
    const events = await collect(responseFrom(['event: done\r\ndata: {"type":"done"}\r\n\r\n']));
    expect(events).toEqual([{ type: "done" }]);
  });

  it("ignora blocos sem dados", async () => {
    const events = await collect(responseFrom([': comentário\n\nevent: done\ndata: {"type":"done"}\n\n']));
    expect(events).toEqual([{ type: "done" }]);
  });
});