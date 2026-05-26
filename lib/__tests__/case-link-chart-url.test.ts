import { describe, expect, it } from "vitest";
import {
  parseCaseLinkChartUrlState,
  serializeCaseLinkChartUrlState,
} from "../case-link-chart-url";

describe("case link chart URL state", () => {
  it("parses valid shareable graph state and drops invalid values", () => {
    const state = parseCaseLinkChartUrlState(
      new URLSearchParams(
        "yearFrom=1963&yearTo=1979&type=person&type=org&type=bad&node=oswald&edge=cia--oswald&from= oswald &to=fbi",
      ),
    );

    expect(state).toEqual({
      yearFrom: 1963,
      yearTo: 1979,
      types: ["person", "org"],
      node: "oswald",
      edge: "cia--oswald",
      from: "oswald",
      to: "fbi",
    });
  });

  it("accepts Next searchParams object shape", () => {
    expect(
      parseCaseLinkChartUrlState({
        yearFrom: "bad",
        yearTo: ["2005"],
        type: ["place", "place", "concept"],
      }),
    ).toEqual({
      yearTo: 2005,
      types: ["place", "concept"],
    });
  });

  it("serializes clean state in stable parameter order", () => {
    expect(
      serializeCaseLinkChartUrlState({
        yearFrom: 1950,
        yearTo: 2005,
        types: ["person", "org"],
        edge: "cia--oswald",
        from: "oswald",
        to: "fbi",
      }),
    ).toBe(
      "yearFrom=1950&yearTo=2005&type=person&type=org&edge=cia--oswald&from=oswald&to=fbi",
    );
  });
});
