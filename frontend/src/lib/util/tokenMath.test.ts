import { describe, expect, it } from "vitest";

import { formatTokenAmount, parseAmountToI128 } from "@/lib/util/tokenMath";

describe("parseAmountToI128", () => {
  it("returns 0n for "0" at any decimal count", () => {
    expect(parseAmountToI128("0", 8)).toBe(0n);
    expect(parseAmountToI128("0", 7)).toBe(0n);
    expect(parseAmountToI128("0", 0)).toBe(0n);
  });

  it("scales a whole number by 10**decimals", () => {
    expect(parseAmountToI128("1", 8)).toBe(100000000n);
    expect(parseAmountToI128("1", 7)).toBe(10000000n);
    expect(parseAmountToI128("42", 2)).toBe(4200n);
  });

  it("pads a fractional part to the requested decimals", () => {
    expect(parseAmountToI128("1.5", 8)).toBe(150000000n);
    expect(parseAmountToI128("0.5", 8)).toBe(50000000n);
    expect(parseAmountToI128("0.05", 8)).toBe(5000000n);
    expect(parseAmountToI128("1.25", 2)).toBe(125n);
  });

  it("pads a short fractional part with trailing zeros", () => {
    expect(parseAmountToI128("1.5", 7)).toBe(15000000n);
    expect(parseAmountToI128("0.1", 6)).toBe(100000n);
  });

  it("truncates (does NOT round) when the fractional part has fewer digits than decimals", () => {
    // The implementation slices fractionalPart to `decimals` after padding,
    // so a 2-char fraction with decimals=4 yields 2 chars padded to 4 (no truncation here).
    // The headline behaviour is: no rounding up of digits beyond `decimals`.
    expect(parseAmountToI128("0.999", 2)).toBe(99n);  // 0.99 -> 99, NOT 100 (no round-up)
    expect(parseAmountToI128("1.999", 2)).toBe(199n); // 1.99 -> 199, NOT 200
  });

  it("throws when the fractional part has MORE digits than `decimals`", () => {
    expect(() => parseAmountToI128("1.12345678", 4)).toThrow();
    expect(() => parseAmountToI128("0.123", 2)).toThrow();
    expect(() => parseAmountToI128("1.001", 2)).toThrow();
  });

  it("rejects non-numeric input", () => {
    expect(() => parseAmountToI128("abc", 8)).toThrow();
    expect(() => parseAmountToI128("1.2.3", 8)).toThrow();
    expect(() => parseAmountToI128("1e5", 8)).toThrow();
    expect(() => parseAmountToI128("-1", 8)).toThrow();
    expect(() => parseAmountToI128("0x123", 8)).toThrow();
    expect(() => parseAmountToI128("12abc", 8)).toThrow();
  });

  it("rejects empty input (after trim)", () => {
    expect(() => parseAmountToI128("", 8)).toThrow();
    expect(() => parseAmountToI128("   ", 8)).toThrow();
    expect(() => parseAmountToI128("\t", 8)).toThrow();
  });

  it("trims surrounding whitespace before validating", () => {
    expect(parseAmountToI128("  1.5  ", 8)).toBe(150000000n);
    expect(parseAmountToI128("\t0.25\n", 8)).toBe(25000000n);
  });
});

describe("formatTokenAmount", () => {
  it("returns "-" for undefined", () => {
    expect(formatTokenAmount(undefined, 7)).toBe("-");
  });

  it("returns the whole part with no fractional suffix when the value is an exact multiple of the scale", () => {
    expect(formatTokenAmount(100000000n, 8)).toBe("1");
    expect(formatTokenAmount(0n, 8)).toBe("0");
    expect(formatTokenAmount(50000000n, 8)).toBe("0.5");
  });

  it("strips trailing zeros from the fractional part", () => {
    expect(formatTokenAmount(150000000n, 8)).toBe("1.5");
    expect(formatTokenAmount(105000000n, 8)).toBe("1.05");
    expect(formatTokenAmount(100500000n, 8)).toBe("1.005");
  });

  it("uses the configured decimals (default 7)", () => {
    expect(formatTokenAmount(15000000n, 7)).toBe("1.5");
    expect(formatTokenAmount(15000000n, 8)).toBe("0.15");
  });
});

describe("formatTokenAmount ∘ parseAmountToI128 round-trip", () => {
  const cases: Array<[string, number]> = [
    ["0", 8],
    ["1", 8],
    ["1.5", 8],
    ["0.5", 8],
    ["0.05", 8],
    ["1.25", 2],
    ["42", 0],
    ["1.00000001", 8],
    ["0.123456", 6],
    ["0.99999999", 8],
    ["123456789.00000001", 8],
  ];

  for (const [input, decimals] of cases) {
    it(`round-trips ${input} at ${decimals} decimals`, () => {
      const parsed = parseAmountToI128(input, decimals);
      const formatted = formatTokenAmount(parsed, decimals);
      // Re-parse the formatted output and compare — the canonical form
      // might strip trailing zeros (1.50 -> 1.5), so compare numerically.
      expect(parseAmountToI128(formatted, decimals)).toBe(parsed);
    });
  }

  it("round-trips a value with all-zero fractional part as a bare integer", () => {
    const parsed = parseAmountToI128("1.0", 8);
    expect(formatTokenAmount(parsed, 8)).toBe("1");
    expect(parseAmountToI128(formatTokenAmount(parsed, 8), 8)).toBe(parsed);
  });
});
