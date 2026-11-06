import { describe, expect, it } from "vitest";
import { formatDayMonth, formatDue, formatRelativeDay, formatTime, timeAgo } from "./format";

// 04/11/2026 13:00 UTC = 10:00 em Brasília
const iso = "2026-11-04T13:00:00Z";
const sameDay = new Date("2026-11-04T18:00:00Z");

describe("datas no fuso de Brasília", () => {
  it("formata horário e dia", () => {
    expect(formatTime(iso)).toBe("10:00");
    expect(formatDayMonth(iso)).toBe("04 nov");
  });

  it("mostra só o horário para prazos de hoje", () => {
    expect(formatDue(iso, sameDay)).toBe("10:00");
    expect(formatDue(iso, new Date("2026-11-06T12:00:00Z"))).toBe("04 nov, 10:00");
  });

  it("descreve hoje, ontem e datas antigas", () => {
    expect(formatRelativeDay(iso, sameDay)).toBe("Hoje");
    expect(formatRelativeDay(iso, new Date("2026-11-05T15:00:00Z"))).toBe("Ontem");
    expect(formatRelativeDay(iso, new Date("2026-11-10T15:00:00Z"))).toBe("04 nov");
  });

  it("calcula tempo relativo", () => {
    expect(timeAgo(iso, new Date("2026-11-04T13:30:00Z").getTime())).toBe("há 30 min");
    expect(timeAgo(iso, new Date("2026-11-10T13:00:00Z").getTime())).toBe("há 6 dias");
  });
});