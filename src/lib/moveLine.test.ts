import { describe, it, expect } from "vitest";
import { moveLine } from "./moveLine";

const text = "one\ntwo\nthree";

describe("moveLine", () => {
  it("moves the cursor line up", () => {
    // cursor on "two" (offset 5)
    const result = moveLine(text, 5, 5, -1);
    expect(result).toEqual({
      value: "two\none\nthree",
      selectionStart: 1,
      selectionEnd: 1,
    });
  });

  it("moves the cursor line down", () => {
    // cursor on "two" (offset 5)
    const result = moveLine(text, 5, 5, 1);
    expect(result).toEqual({
      value: "one\nthree\ntwo",
      selectionStart: 11,
      selectionEnd: 11,
    });
  });

  it("returns null when moving the first line up", () => {
    expect(moveLine(text, 2, 2, -1)).toBeNull();
  });

  it("returns null when moving the last line down", () => {
    expect(moveLine(text, 10, 10, 1)).toBeNull();
  });

  it("moves a multi-line selection as a block", () => {
    // selection spans "two" and "three" in "one\ntwo\nthree\nfour"
    const result = moveLine("one\ntwo\nthree\nfour", 5, 10, -1);
    expect(result).toEqual({
      value: "two\nthree\none\nfour",
      selectionStart: 1,
      selectionEnd: 6,
    });
  });

  it("does not drag along a line the selection only touches at offset 0", () => {
    // selection from "two" to the very start of "three"
    const result = moveLine(text, 4, 8, 1);
    expect(result).toEqual({
      value: "one\nthree\ntwo",
      selectionStart: 10,
      selectionEnd: 14,
    });
  });

  it("handles empty lines", () => {
    const result = moveLine("one\n\ntwo", 4, 4, 1);
    expect(result).toEqual({
      value: "one\ntwo\n",
      selectionStart: 8,
      selectionEnd: 8,
    });
  });

  it("keeps the caret column when moving past a shorter line", () => {
    // cursor at end of "three" (offset 13), moving up past "two"
    const result = moveLine(text, 13, 13, -1);
    expect(result).toEqual({
      value: "one\nthree\ntwo",
      selectionStart: 9,
      selectionEnd: 9,
    });
  });

  it("returns null for single-line text", () => {
    expect(moveLine("only", 2, 2, -1)).toBeNull();
    expect(moveLine("only", 2, 2, 1)).toBeNull();
  });
});
