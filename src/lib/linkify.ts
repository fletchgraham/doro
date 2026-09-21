// Find the links in a task or subtask's text so they can be rendered as
// anchors. Two forms are recognised: bare URLs (http://, https:// or
// www.) and markdown-style [label](url). Everything else is plain text.

export type TextSegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

// A markdown link, or a bare URL running to the next whitespace/angle
// bracket. Trailing punctuation is trimmed off bare URLs afterwards.
const LINK_PATTERN =
  /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(?<![\w.@/])(?:https?:\/\/|www\.)[^\s<>]+/gi;

const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/;

const toHref = (url: string): string =>
  /^www\./i.test(url) ? `https://${url}` : url;

/**
 * Trim characters a sentence would hang off the end of a URL: "see
 * https://x.test/a." shouldn't link the full stop, and a closing paren
 * only belongs to the URL if it has a matching opening one inside.
 */
const trimBareUrl = (url: string): string => {
  let trimmed = url;
  for (;;) {
    const before = trimmed;
    trimmed = trimmed.replace(TRAILING_PUNCTUATION, "");
    while (trimmed.endsWith(")")) {
      const opens = (trimmed.match(/\(/g) ?? []).length;
      const closes = (trimmed.match(/\)/g) ?? []).length;
      if (closes <= opens) break;
      trimmed = trimmed.slice(0, -1);
    }
    if (trimmed === before) return trimmed;
  }
};

/** Split text into plain runs and links, in order. */
export const linkify = (text: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const [raw, label, mdUrl] = match;
    const start = match.index;
    let linkText: string;
    let href: string;
    let end: number;
    if (mdUrl !== undefined) {
      linkText = label;
      href = mdUrl;
      end = start + raw.length;
    } else {
      const url = trimBareUrl(raw);
      // A bare "www." or "http://" with nothing after it isn't a link
      if (!/^(https?:\/\/|www\.).+/i.test(url)) continue;
      linkText = url;
      href = toHref(url);
      end = start + url.length;
    }
    if (start > last) segments.push({ type: "text", text: text.slice(last, start) });
    segments.push({ type: "link", text: linkText, href });
    last = end;
  }
  if (last < text.length) segments.push({ type: "text", text: text.slice(last) });
  return segments;
};

export const hasLinks = (text: string): boolean =>
  linkify(text).some((s) => s.type === "link");
