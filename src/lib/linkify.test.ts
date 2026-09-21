import { expect, test } from "vitest";
import { hasLinks, linkify } from "./linkify";

test("plain text is one segment", () => {
  expect(linkify("just a task")).toEqual([{ type: "text", text: "just a task" }]);
  expect(linkify("")).toEqual([]);
  expect(hasLinks("just a task")).toBe(false);
});

test("bare http(s) URLs become links", () => {
  expect(linkify("review https://example.test/pr/1 today")).toEqual([
    { type: "text", text: "review " },
    { type: "link", text: "https://example.test/pr/1", href: "https://example.test/pr/1" },
    { type: "text", text: " today" },
  ]);
  expect(linkify("http://a.test")).toEqual([
    { type: "link", text: "http://a.test", href: "http://a.test" },
  ]);
  expect(hasLinks("see http://a.test")).toBe(true);
});

test("www. URLs link with https", () => {
  expect(linkify("check www.example.test/docs")).toEqual([
    { type: "text", text: "check " },
    { type: "link", text: "www.example.test/docs", href: "https://www.example.test/docs" },
  ]);
});

test("trailing punctuation stays outside the link", () => {
  expect(linkify("read https://a.test/x.")).toEqual([
    { type: "text", text: "read " },
    { type: "link", text: "https://a.test/x", href: "https://a.test/x" },
    { type: "text", text: "." },
  ]);
  expect(linkify("(see https://a.test/x)")).toEqual([
    { type: "text", text: "(see " },
    { type: "link", text: "https://a.test/x", href: "https://a.test/x" },
    { type: "text", text: ")" },
  ]);
  // A balanced paren is part of the URL (wikipedia-style)
  expect(linkify("https://a.test/Foo_(bar)")).toEqual([
    { type: "link", text: "https://a.test/Foo_(bar)", href: "https://a.test/Foo_(bar)" },
  ]);
  expect(linkify("is it https://a.test/x?")).toEqual([
    { type: "text", text: "is it " },
    { type: "link", text: "https://a.test/x", href: "https://a.test/x" },
    { type: "text", text: "?" },
  ]);
});

test("markdown links use their label", () => {
  expect(linkify("fix [the bug](https://a.test/issues/7) first")).toEqual([
    { type: "text", text: "fix " },
    { type: "link", text: "the bug", href: "https://a.test/issues/7" },
    { type: "text", text: " first" },
  ]);
});

test("several links in one text", () => {
  const segments = linkify("https://a.test and [b](https://b.test) and www.c.test");
  expect(segments.filter((s) => s.type === "link").map((s) => s.href)).toEqual([
    "https://a.test",
    "https://b.test",
    "https://www.c.test",
  ]);
});

test("a bare scheme or www. alone is not a link", () => {
  expect(hasLinks("https://")).toBe(false);
  expect(hasLinks("www.")).toBe(false);
  expect(hasLinks("javascript:alert(1)")).toBe(false);
  expect(hasLinks("[x](javascript:alert(1))")).toBe(false);
});
