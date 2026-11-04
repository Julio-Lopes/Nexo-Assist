import { describe, expect, it } from "vitest";
import { derivePriority } from "./priority";

describe("derivePriority", () => {
  it("é crítica quando algo está parado para a equipe", () => {
    const result = derivePriority({ type: "INC", affected: "team", blocking: true, deadlineToday: false });
    expect(result.priority).toBe("critical");
  });

  it("é crítica quando está parado para a empresa", () => {
    const result = derivePriority({ type: "INC", affected: "company", blocking: true, deadlineToday: false });
    expect(result.priority).toBe("critical");
  });

  it("é alta quando há compromisso no mesmo dia (cenário da VPN do protótipo)", () => {
    const result = derivePriority({ type: "INC", affected: "self", blocking: false, deadlineToday: true });
    expect(result.priority).toBe("high");
  });

  it("é alta quando impede uma pessoa de trabalhar", () => {
    const result = derivePriority({ type: "INC", affected: "self", blocking: true, deadlineToday: false });
    expect(result.priority).toBe("high");
  });

  it("é média quando atrapalha mas há alternativa", () => {
    const result = derivePriority({ type: "INC", affected: "self", blocking: false, deadlineToday: false });
    expect(result.priority).toBe("medium");
  });

  it("é baixa para pedidos sem urgência", () => {
    const result = derivePriority({ type: "REQ", affected: "self", blocking: false, deadlineToday: false });
    expect(result.priority).toBe("low");
  });

  it("sempre devolve um motivo legível", () => {
    const result = derivePriority({ type: "REQ", affected: "team", blocking: false, deadlineToday: false });
    expect(result.reason.length).toBeGreaterThan(0);
  });
});