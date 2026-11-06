import { describe, expect, it } from "vitest";
import { SlidingWindowLimiter } from "./rate-limit";

describe("SlidingWindowLimiter", () => {
  it("allows up to the configured limit and blocks the next call", () => {
    const limiter = new SlidingWindowLimiter(2, 1_000);

    expect(limiter.take("client", 0)).toBe(0);
    expect(limiter.take("client", 1)).toBe(0);
    expect(limiter.take("client", 2)).toBe(998);
  });

  it("does not consume a slot when checking retryAfter", () => {
    const limiter = new SlidingWindowLimiter(1, 1_000);

    expect(limiter.retryAfter("client", 0)).toBe(0);
    expect(limiter.take("client", 0)).toBe(0);
    expect(limiter.retryAfter("client", 1)).toBe(999);
    expect(limiter.take("client", 1)).toBe(999);
  });

  it("expires old calls from the window", () => {
    const limiter = new SlidingWindowLimiter(1, 1_000);

    limiter.take("client", 0);
    expect(limiter.take("client", 1_000)).toBe(0);
  });
});