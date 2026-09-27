import { describe, expect, it } from "vitest";

import * as p from "@/lib/present";

describe("no machine vocabulary reaches a page", () => {
  it("writes out every state the contract can write", () => {
    for (const s of ["PROPOSED", "ACTIVE", "DECIDED", "UNDER_APPEAL", "PAYMENT_RELEASABLE",
                     "SETTLED", "CLOSED_UNPAID", "CANCELLED"]) {
      expect(p.orderState(s)).not.toMatch(/_|[A-Z]{3,}/);
    }
    for (const s of ["SATISFIED", "NOT_SATISFIED", "NOT_ESTABLISHED", "NOT_APPLICABLE"]) expect(p.requirementStatus(s)).not.toMatch(/_/);
    for (const s of ["ACCEPTED", "REJECTED", "UNDETERMINED"]) expect(p.outcome(s)).not.toMatch(/_/);
  });

  it("writes out the validators' references and keeps their words", () => {
    expect(p.writeOut("ev-000007 shows P2 kept and C1 met.")).toBe("Evidence 7 shows principle 2 kept and criterion 1 met.");
    expect(p.writeOut("MOD 4000TL3-X on the plate")).toBe("MOD 4000TL3-X on the plate");
  });

  it("formats money and time the way the contract records them", () => {
    expect(p.gen("2000000000000000000")).toBe("2 GEN");
    expect(p.gen("1999000000000000000")).toBe("1.999 GEN");
    expect(p.parseGen("0.05")).toBe(50_000_000_000_000_000n);
    expect(p.parseGen("abc")).toBeNull();
    expect(p.moment("2026-09-26T18:08:00Z")).toBe("26 Sep 2026, 18:08 UTC");
    expect(p.requirement({ type: "AFTER_PHOTO", min_count: 2 })).toBe("2 after photographs");
  });

  it("marks a note the contract's cap cut off, and leaves a whole one alone", () => {
    expect(p.validatorNote("x".repeat(200))).toMatch(/first 200 characters/);
    expect(p.validatorNote("A whole note.")).toBe("A whole note.");
  });

  it("keeps the contract's own refusal wording", () => {
    expect(p.refusal("[EXPECTED] the appeal window is still open")).toBe("The appeal window is still open.");
  });
});
