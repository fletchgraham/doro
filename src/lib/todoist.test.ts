import { describe, expect, test } from "vitest";
import { getTodoistTaskUrl, slugifyTodoistContent } from "./todoist";

describe("slugifyTodoistContent", () => {
  test("lowercases and replaces spaces with dashes", () => {
    expect(slugifyTodoistContent("Hello World")).toBe("hello-world");
  });

  test("collapses multiple spaces and dashes", () => {
    expect(slugifyTodoistContent("foo   bar---baz")).toBe("foo-bar-baz");
  });

  test("strips leading and trailing dashes", () => {
    expect(slugifyTodoistContent("---foo bar---")).toBe("foo-bar");
  });

  test("removes punctuation", () => {
    expect(slugifyTodoistContent("Buy milk, eggs, & bread!")).toBe(
      "buy-milk-eggs-bread"
    );
  });

  test("strips non-ASCII characters", () => {
    expect(slugifyTodoistContent("café résumé")).toBe("cafe-resume");
  });

  test("strips emoji", () => {
    expect(slugifyTodoistContent("ship it 🚀 today")).toBe("ship-it-today");
  });

  test("handles empty string", () => {
    expect(slugifyTodoistContent("")).toBe("");
  });

  test("handles only-punctuation string", () => {
    expect(slugifyTodoistContent("!!!")).toBe("");
  });

  test("preserves underscores and digits", () => {
    expect(slugifyTodoistContent("task_2 v3")).toBe("task_2-v3");
  });
});

describe("getTodoistTaskUrl", () => {
  test("matches the user-provided example URL format", () => {
    // From the user: https://app.todoist.com/app/task/ge-top-post-variant-model-shots-6gJgjp2fx2PwpRHC
    expect(
      getTodoistTaskUrl("6gJgjp2fx2PwpRHC", "ge top post variant model shots")
    ).toBe(
      "https://app.todoist.com/app/task/ge-top-post-variant-model-shots-6gJgjp2fx2PwpRHC"
    );
  });

  test("builds URL with slug and id", () => {
    expect(getTodoistTaskUrl("abc123", "Hello World")).toBe(
      "https://app.todoist.com/app/task/hello-world-abc123"
    );
  });

  test("falls back to just the id when content is empty", () => {
    expect(getTodoistTaskUrl("abc123", "")).toBe(
      "https://app.todoist.com/app/task/abc123"
    );
  });

  test("falls back to just the id when content slugifies to empty", () => {
    expect(getTodoistTaskUrl("abc123", "!!!")).toBe(
      "https://app.todoist.com/app/task/abc123"
    );
  });
});
