import { describe, expect, it } from "vitest";

import * as p from "@/lib/present";

describe("no machine vocabulary reaches a page", () => {
  it("writes out every state the contract can write", () => {
    for (const s of ["PROPOSED", "AWAITING_EVIDENCE", "ACCEPTED", "REJECTED", "UNDETERMINED", "APPEALED",
                     "FINALIZED", "CLOSED", "CANCELLED"]) {
      expect(p.orderState(s)).not.toMatch(/_|[A-Z]{3,}/);
    }
    for (const s of ["SATISFIED", "VIOLATED", "NOT_APPLICABLE", "UNCLEAR"]) expect(p.principleStatus(s)).not.toMatch(/_/);
    for (const s of ["MET", "NOT_MET", "UNCLEAR"]) expect(p.criterionStatus(s)).not.toMatch(/_/);
  });

  it("writes out a panel's references and keeps its words", () => {
    expect(p.writeOut("ev-000007 shows P2 kept and C1 met.")).toBe("Item 7 shows principle 2 kept and criterion 1 met.");
    expect(p.writeOut("MOD 4000TL3-X on the plate")).toBe("MOD 4000TL3-X on the plate");
  });

  it("formats money and time the way the contract records them", () => {
    expect(p.gen("2000000000000000000")).toBe("2 GEN");
    expect(p.gen("1999000000000000000")).toBe("1.999 GEN");
    expect(p.parseGen("0.05")).toBe(50_000_000_000_000_000n);
    expect(p.parseGen("abc")).toBeNull();
    expect(p.moment("2026-09-26T18:08:00Z")).toBe("26 Sep 2026, 18:08 UTC");
    expect(p.requirement({ type: "IMAGE", min_count: 2 })).toBe("2 photographs");
  });

  it("marks a note the contract's cap cut off, and leaves a whole one alone", () => {
    expect(p.panelNote("x".repeat(200))).toMatch(/first 200 characters/);
    expect(p.panelNote("A whole note.")).toBe("A whole note.");
  });

  it("keeps the contract's own refusal wording", () => {
    expect(p.refusal("[EXPECTED] the appeal window is still open")).toBe("The appeal window is still open.");
  });
});
