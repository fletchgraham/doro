// Backup and restore of everything Doro keeps in localStorage. Every key the
// app owns starts with "doro", so a backup is simply all of those keys.
// Values holding JSON objects/arrays are embedded as JSON so the file is
// readable; everything else is kept as the raw stored string.

export const BACKUP_APP = "doro";
export const BACKUP_VERSION = 1;
const KEY_PREFIX = "doro";

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

const isAppKey = (key: string) => key.startsWith(KEY_PREFIX);

const appKeys = (storage: Storage): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && isAppKey(key)) keys.push(key);
  }
  return keys.sort();
};

const decode = (raw: string): unknown => {
  try {
    const parsed = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object") return parsed;
  } catch {
    // Not JSON, keep the raw string
  }
  return raw;
};

const encode = (value: unknown): string =>
  typeof value === "string" ? value : JSON.stringify(value);

export const createBackup = (
  storage: Storage,
  now: Date = new Date()
): Backup => {
  const data: Record<string, unknown> = {};
  for (const key of appKeys(storage)) {
    data[key] = decode(storage.getItem(key) ?? "");
  }
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data,
  };
};

export const backupFilename = (now: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `doro-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}.json`;
};

// Parse and validate a backup file's text. Throws with a readable message
// when the file isn't a Doro backup.
export const parseBackup = (text: string): Backup => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    (parsed as Backup).app !== BACKUP_APP ||
    typeof (parsed as Backup).data !== "object" ||
    (parsed as Backup).data === null ||
    Array.isArray((parsed as Backup).data)
  ) {
    throw new Error("That file isn't a Doro backup.");
  }
  const backup = parsed as Backup;
  if (typeof backup.version !== "number" || backup.version > BACKUP_VERSION) {
    throw new Error(
      "That backup was made by a newer version of Doro and can't be restored."
    );
  }
  return backup;
};

// Replace all of the app's stored state with the backup's. Keys in storage
// that aren't in the backup are removed, so the result matches the backup
// exactly. Non-Doro keys in the backup are ignored.
export const restoreBackup = (storage: Storage, backup: Backup): void => {
  for (const key of appKeys(storage)) storage.removeItem(key);
  for (const [key, value] of Object.entries(backup.data)) {
    if (!isAppKey(key) || value === undefined || value === null) continue;
    storage.setItem(key, encode(value));
  }
};
