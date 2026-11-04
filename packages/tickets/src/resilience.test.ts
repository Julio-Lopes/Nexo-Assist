import { describe, expect, it } from "vitest";
import { TicketNotFoundError, TicketSystemUnavailableError } from "./errors";
import { withInstability, withRetry } from "./resilience";

const noSleep = async () => {};

describe("withInstability", () => {
  const target = { ping: async () => "pong" };

  it("falha com erro transitório quando o sorteio cai na taxa de falha", async () => {
    const unstable = withInstability(target, {
      failureRate: 0.5, minLatencyMs: 0, maxLatencyMs: 0, random: () => 0, sleep: noSleep,
    });
    await expect(unstable.ping()).rejects.toBeInstanceOf(TicketSystemUnavailableError);
  });

  it("executa normalmente fora da taxa de falha", async () => {
    const unstable = withInstability(target, {
      failureRate: 0.5, minLatencyMs: 0, maxLatencyMs: 0, random: () => 0.99, sleep: noSleep,
    });
    await expect(unstable.ping()).resolves.toBe("pong");
  });
});

describe("withRetry", () => {
  it("tenta de novo em falha transitória até dar certo", async () => {
    let calls = 0;
    const flaky = {
      run: async () => {
        calls++;
        if (calls < 3) throw new TicketSystemUnavailableError();
        return "ok";
      },
    };

    const retried: number[] = [];
    const resilient = withRetry(flaky, {
      retries: 2, baseDelayMs: 10, sleep: noSleep, onRetry: ({ attempt }) => retried.push(attempt),
    });

    await expect(resilient.run()).resolves.toBe("ok");
    expect(calls).toBe(3);
    expect(retried).toEqual([1, 2]);
  });

  it("desiste depois do limite de tentativas", async () => {
    const down = { run: async () => { throw new TicketSystemUnavailableError(); } };
    const resilient = withRetry(down, { retries: 2, baseDelayMs: 10, sleep: noSleep });
    await expect(resilient.run()).rejects.toBeInstanceOf(TicketSystemUnavailableError);
  });

  it("não repete erros de negócio", async () => {
    let calls = 0;
    const missing = {
      run: async () => {
        calls++;
        throw new TicketNotFoundError("INC-00000");
      },
    };
    const resilient = withRetry(missing, { retries: 2, baseDelayMs: 10, sleep: noSleep });

    await expect(resilient.run()).rejects.toBeInstanceOf(TicketNotFoundError);
    expect(calls).toBe(1);
  });
});