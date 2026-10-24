import { describe, it, expect } from "vitest";
import { appendEvent, verifyChain } from "../hashchain";
import type { StoredEvent } from "../hashchain";

function buildChain(n: number): StoredEvent[] {
  let chain: StoredEvent[] = [];
  for (let i = 1; i <= n; i++) {
    chain = appendEvent(chain, {
      type: "TEST",
      entityId: `entity-${i}`,
      actor: "user:test",
      atIso: `2026-11-0${(i % 9) + 1}T10:00:00+05:30`,
      payload: { n: i },
    });
  }
  return chain;
}

describe("hashchain", () => {
  it("10 events verify cleanly", () => {
    const chain = buildChain(10);
    expect(chain).toHaveLength(10);
    expect(verifyChain(chain)).toEqual({ valid: true });
  });

  it("mutated event fails at exact seq", () => {
    const chain = buildChain(10);
    const mutated = chain.map((e, i) => (i === 4 ? { ...e, payload: { tampered: true } } : e));
    expect(verifyChain(mutated)).toEqual({ valid: false, failedAt: 5 });
  });

  it("removed event fails at exact seq", () => {
    const chain = buildChain(10);
    const removed = chain.filter((_, i) => i !== 2);
    expect(verifyChain(removed)).toEqual({ valid: false, failedAt: 3 });
  });

  it("empty chain verifies (vacuous truth)", () => {
    expect(verifyChain([])).toEqual({ valid: true });
  });

  it("sequential append preserves hash linkage", () => {
    const chain = buildChain(3);
    expect(chain[1]!.prevHash).toBe(chain[0]!.hash);
    expect(chain[2]!.prevHash).toBe(chain[1]!.hash);
  });
});
