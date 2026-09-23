import { useRef, useState, type ReactNode } from "react";
import { Download, Monitor, Moon, Sun, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { FEATURE_DEFINITIONS } from "@/lib/settings";
import {
  backupFilename,
  createBackup,
  parseBackup,
  restoreBackup,
} from "@/lib/backup";
import type { Theme } from "../hooks/useTheme";
import type { SettingsManager } from "../hooks/useSettings";
import type { WorkflowySync } from "../hooks/useWorkflowySync";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  settings: SettingsManager;
  workflowySync: WorkflowySync;
}

const THEMES: Array<{ value: Theme; label: string; icon: ReactNode }> = [
  { value: "light", label: "Light", icon: <Sun /> },
  { value: "dark", label: "Dark", icon: <Moon /> },
  { value: "system", label: "System", icon: <Monitor /> },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

// A labelled switch with a line of explanation underneath
function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="mt-0.5"
      />
    </div>
  );
}

// Download every piece of stored app state as one JSON file, or replace it
// all from such a file (then reload so every hook re-reads storage)
function BackupSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const exportData = () => {
    setError(null);
    const json = JSON.stringify(createBackup(localStorage), null, 2);
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    setError(null);
    try {
      const backup = parseBackup(await file.text());
      const when = backup.exportedAt
        ? ` from ${new Date(backup.exportedAt).toLocaleString()}`
        : "";
      if (
        !window.confirm(
          `Replace all of Doro's current data with the backup${when}? This can't be undone.`
        )
      )
        return;
      restoreBackup(localStorage, backup);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  };

  return (
    <Section title="Backup">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={exportData}>
          <Download />
          Export data
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload />
          Restore from file
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Backup file"
          data-testid="backup-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) importData(file);
          }}
        />
      </div>
      <p
        className={
          error
            ? "text-xs text-red-600 dark:text-red-400"
            : "text-xs text-muted-foreground"
        }
      >
        {error ??
          "Saves tasks, projects, templates and settings (including API keys) as a JSON file. Restoring replaces everything with the file's contents."}
      </p>
    </Section>
  );
}

function SettingsModal({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  settings,
  workflowySync,
}: SettingsModalProps) {
  const { features, setFeature, todoist, setTodoist, workflowy, setWorkflowy } =
    settings;
  const { syncNow, syncing, status, error, canSync } = workflowySync;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-md max-h-[85vh] overflow-y-auto"
        data-testid="settings-modal"
      >
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Pick a theme, switch features off to simplify the app, and
            connect Todoist or Workflowy. Everything is saved as you go, and
            you can back it all up to a file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Section title="Appearance">
            <div
              className="inline-flex rounded-md border p-0.5 gap-0.5"
              role="radiogroup"
              aria-label="Theme"
            >
              {THEMES.map((t) => (
                <Button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.value}
                  variant={theme === t.value ? "default" : "ghost"}
                  size="sm"
                  className={cn("gap-1.5", theme !== t.value && "text-muted-foreground")}
                  onClick={() => onThemeChange(t.value)}
                >
                  {t.icon}
                  {t.label}
                </Button>
              ))}
            </div>
          </Section>

          <Section title="Features">
            {FEATURE_DEFINITIONS.map((def) => (
              <ToggleRow
                key={def.name}
                id={`feature-${def.name}`}
                label={def.label}
                description={def.description}
                checked={features[def.name]}
                onCheckedChange={(on) => setFeature(def.name, on)}
              />
            ))}
          </Section>

          <Section title="Todoist">
            <ToggleRow
              id="todoist-mode"
              label="Todoist mode"
              description="Import the tasks due today from Todoist into the Ready list."
              checked={todoist.enabled}
              onCheckedChange={(on) => setTodoist({ enabled: on })}
            />
            {todoist.enabled && (
              <div className="space-y-2">
                <Input
                  type="password"
                  value={todoist.token}
                  onChange={(e) => setTodoist({ token: e.target.value.trim() })}
                  placeholder="Todoist API token..."
                  className="h-8 text-sm"
                  aria-label="Todoist API token"
                  autoComplete="off"
                />
                <Input
                  value={todoist.label}
                  onChange={(e) => setTodoist({ label: e.target.value })}
                  placeholder="Label filter (optional)"
                  className="h-8 text-sm"
                  aria-label="Todoist label filter"
                />
                <p className="text-xs text-muted-foreground">
                  Find your token under Todoist Settings › Integrations ›
                  Developer.
                </p>
              </div>
            )}
          </Section>

          <Section title="Workflowy">
            <ToggleRow
              id="workflowy-mode"
              label="Workflowy mode"
              description="Sync the day's tasks with the children of a Workflowy node, both ways."
              checked={workflowy.enabled}
              onCheckedChange={(on) => setWorkflowy({ enabled: on })}
            />
            {workflowy.enabled && (
              <div className="space-y-2">
                <Input
                  type="password"
                  value={workflowy.apiKey}
                  onChange={(e) =>
                    setWorkflowy({ apiKey: e.target.value.trim() })
                  }
                  placeholder="Workflowy API key..."
                  className="h-8 text-sm"
                  aria-label="Workflowy API key"
                  autoComplete="off"
                />
                <div className="flex items-center gap-2">
                  <Input
                    value={workflowy.parentInput}
                    onChange={(e) =>
                      setWorkflowy({ parentInput: e.target.value })
                    }
                    onKeyDown={(e) => e.key === "Enter" && canSync && syncNow()}
                    placeholder="Parent node link or UUID..."
                    className="flex-1 h-8 text-sm"
                    aria-label="Workflowy parent node"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncNow()}
                    disabled={syncing || !canSync}
                  >
                    {syncing ? "Syncing..." : "Sync"}
                  </Button>
                </div>
                <p
                  className={
                    error
                      ? "text-xs text-red-600 dark:text-red-400"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {error ??
                    status ?? (
                      <>
                        Get an API key at{" "}
                        <a
                          href="https://workflowy.com/api-key"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-foreground"
                        >
                          workflowy.com/api-key
                        </a>
                        .
                      </>
                    )}
                </p>
              </div>
            )}
          </Section>

          <BackupSection />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsModal;
