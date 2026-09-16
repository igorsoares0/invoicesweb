import { describe, expect, it } from "vitest";
import { findIssueProblems, issueHeadline, problemsToFieldErrors, type IssueCheckInput } from "./issues";

const ready: IssueCheckInput = {
  clientId: "client-1",
  issueDate: "2026-09-12",
  endDate: "2026-09-26",
  items: [{ id: "i1", description: "Signage package", unitPrice: "2480.00", taxExempt: false, taxExemptReason: null }],
};

describe("findIssueProblems", () => {
  it("finds nothing on a complete invoice", () => {
    expect(findIssueProblems(ready)).toEqual([]);
  });

  it("reports each problem with a path the UI can attach to a field or line", () => {
    const problems = findIssueProblems({
      clientId: null,
      issueDate: "2026-09-12",
      endDate: "2026-09-05",
      items: [
        { id: "i1", description: "Signage package", unitPrice: "2480.00", taxExempt: false, taxExemptReason: null },
        { id: "i2", description: "Site survey visit", unitPrice: null, taxExempt: true, taxExemptReason: " " },
      ],
    });

    expect(problems.map((problem) => problem.path)).toEqual([
      "clientId",
      "items.i2.unitPrice",
      "items.i2.taxExemptReason",
      "dueDate",
    ]);
    expect(problems[1]).toMatchObject({ summary: "Line 2 has no unit price", fix: "Set a price, or remove the line" });
    expect(problems[3]).toMatchObject({
      fix: "Sep 5 comes before Sep 12",
      message: "Must be on or after Sep 12",
    });
  });

  it("requires at least one described line", () => {
    expect(findIssueProblems({ ...ready, items: [] }).map((p) => p.path)).toEqual(["items"]);
    const blank = findIssueProblems({ ...ready, items: [{ ...ready.items[0], description: "  " }] });
    expect(blank.map((p) => p.path)).toEqual(["items.i1.description"]);
  });

  it("names the estimate's expiry date when asked", () => {
    const [problem] = findIssueProblems({ ...ready, endDate: "2026-09-01" }, { endPath: "expiryDate", endLabel: "Expiry date" });
    expect(problem).toMatchObject({ path: "expiryDate", summary: "Expiry date is before the issue date" });
  });

  it("allows a due date equal to the issue date", () => {
    expect(findIssueProblems({ ...ready, endDate: "2026-09-12" })).toEqual([]);
  });
});

describe("helpers", () => {
  it("groups messages by path", () => {
    const problems = findIssueProblems({ ...ready, clientId: null });
    expect(problemsToFieldErrors(problems)).toEqual({ clientId: ["Choose a client"] });
  });

  it("words the banner heading", () => {
    expect(issueHeadline(1)).toBe("One thing to fix before sending");
    expect(issueHeadline(3)).toBe("Three things to fix before sending");
    expect(issueHeadline(12)).toBe("12 things to fix before sending");
  });
});
