import { describe, expect, it } from "vitest";
import { isBigQueryBytesBilledExceeded } from "../bigquery-errors";

describe("isBigQueryBytesBilledExceeded", () => {
  it("detects the BigQuery bytes-billed cap reason", () => {
    expect(
      isBigQueryBytesBilledExceeded({
        code: 400,
        errors: [
          {
            reason: "bytesBilledLimitExceeded",
            message: "Query exceeded limit for bytes billed: 268435456",
          },
        ],
      }),
    ).toBe(true);
  });

  it("detects the message even without a reason code", () => {
    expect(
      isBigQueryBytesBilledExceeded(
        new Error("Query exceeded limit for bytes billed: 268435456"),
      ),
    ).toBe(true);
  });

  it("does not treat unrelated warehouse failures as a cap skip", () => {
    expect(isBigQueryBytesBilledExceeded(new Error("Not found: Table"))).toBe(
      false,
    );
    expect(isBigQueryBytesBilledExceeded(null)).toBe(false);
  });
});
