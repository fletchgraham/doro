import { linkify } from "../lib/linkify";

// Task and subtask text with its URLs (and [label](url) links) rendered
// as anchors that open in a new tab. Clicks on a link stop there: they
// mustn't select the row, start a drag or open the inline editor.

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function LinkedText({ text }: { text: string }) {
  const segments = linkify(text);
  return (
    <>
      {segments.map((segment, i) =>
        segment.type === "link" ? (
          <a
            key={i}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stop}
            onDoubleClick={stop}
            onPointerDown={stop}
            className="underline underline-offset-2 decoration-muted-foreground/60 hover:decoration-current break-all"
            title={segment.href}
          >
            {segment.text}
          </a>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </>
  );
}

export default LinkedText;
