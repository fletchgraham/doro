import { describe, expect, it } from "vitest";
import {
  BACKUP_VERSION,
  backupFilename,
  createBackup,
  parseBackup,
  restoreBackup,
} from "./backup";

// Minimal in-memory Storage (tests run in node, without localStorage)
const memoryStorage = (initial: Record<string, string> = {}): Storage => {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
};

const dump = (s: Storage) => {
  const out: Record<string, string> = {};
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i)!;
    out[k] = s.getItem(k)!;
  }
  return out;
};

const SAMPLE = {
  doroTasks: JSON.stringify([{ id: "1", text: "Write", status: "ready" }]),
  doroProjects: JSON.stringify({ projects: [], tasks: [] }),
  doroTheme: "dark",
  doroReadyLocked: "true",
  doroTimeBudget: "3600000",
  doroTodoistLabel: "1e5",
  doroTodoistToken: "secret-token",
  doroWorkflowyApiKey: "secret-key",
  otherApp: "untouched",
};

describe("createBackup", () => {
  it("captures every doro key except credentials, embedding JSON objects and keeping strings raw", () => {
    const backup = createBackup(
      memoryStorage(SAMPLE),
      new Date("2026-09-23T10:00:00Z")
    );
    expect(backup).toEqual({
      app: "doro",
      version: BACKUP_VERSION,
      exportedAt: "2026-09-23T10:00:00.000Z",
      data: {
        doroProjects: { projects: [], tasks: [] },
        doroReadyLocked: "true",
        doroTasks: [{ id: "1", text: "Write", status: "ready" }],
        doroTheme: "dark",
        doroTimeBudget: "3600000",
        doroTodoistLabel: "1e5",
      },
    });
  });
});

describe("restoreBackup", () => {
  it("round-trips storage, keeping this device's credentials", () => {
    const backup = createBackup(memoryStorage(SAMPLE));
    const target = memoryStorage({
      otherApp: "untouched",
      doroTodoistToken: "secret-token",
      doroWorkflowyApiKey: "secret-key",
    });
    restoreBackup(target, parseBackup(JSON.stringify(backup)));
    expect(dump(target)).toEqual(SAMPLE);
  });

  it("ignores credentials inside a backup file", () => {
    const target = memoryStorage({ doroTodoistToken: "mine" });
    restoreBackup(target, {
      app: "doro",
      version: 1,
      exportedAt: "",
      data: { doroTodoistToken: "theirs", doroWorkflowyApiKey: "theirs" },
    });
    expect(dump(target)).toEqual({ doroTodoistToken: "mine" });
  });

  it("removes doro keys missing from the backup and ignores foreign keys", () => {
    const target = memoryStorage({ doroTheme: "light", doroGoldSettings: "{}", keep: "1" });
    restoreBackup(target, {
      app: "doro",
      version: 1,
      exportedAt: "",
      data: { doroTheme: "dark", evil: "x" },
    });
    expect(dump(target)).toEqual({ keep: "1", doroTheme: "dark" });
  });
});

describe("parseBackup", () => {
  it("rejects files that aren't Doro backups", () => {
    expect(() => parseBackup("not json")).toThrow(/valid JSON/);
    expect(() => parseBackup("[]")).toThrow(/Doro backup/);
    expect(() => parseBackup(JSON.stringify({ app: "x", data: {} }))).toThrow(
      /Doro backup/
    );
    expect(() =>
      parseBackup(JSON.stringify({ app: "doro", version: 1, data: [] }))
    ).toThrow(/Doro backup/);
    expect(() =>
      parseBackup(
        JSON.stringify({ app: "doro", version: BACKUP_VERSION + 1, data: {} })
      )
    ).toThrow(/newer version/);
  });
});

describe("backupFilename", () => {
  it("names the file after the local date", () => {
    expect(backupFilename(new Date(2026, 0, 5, 12))).toBe(
      "doro-backup-2026-01-05.json"
    );
  });
});
