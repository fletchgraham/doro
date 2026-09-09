import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TASK_COLORS, colorLabel } from "@/lib/taskColors";
import {
  DEFAULT_GOLD_SETTINGS,
  GOLD_INTERVAL_MS,
  type GoldRule,
  type GoldSettings,
} from "@/lib/gold";

interface GoldSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GoldSettings;
  onChange: (settings: GoldSettings) => void;
}

const INTERVAL_MINUTES = GOLD_INTERVAL_MS / 60000;

const ruleFor = (settings: GoldSettings, color: string): GoldRule =>
  settings[color] ?? DEFAULT_GOLD_SETTINGS[color] ?? { mode: "spend", rate: 0 };

function GoldSettingsModal({
  isOpen,
  onClose,
  settings,
  onChange,
}: GoldSettingsModalProps) {
  // Rate inputs keep their own text so partial entries ("1.") don't get
  // clobbered by re-rendering from the parsed number
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setDrafts(
      Object.fromEntries(
        TASK_COLORS.map((c) => [c.hex, String(ruleFor(settings, c.hex).rate)])
      )
    );
    // Only reseed when opening; edits flow through onChange
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const setRule = (color: string, patch: Partial<GoldRule>) => {
    onChange({ ...settings, [color]: { ...ruleFor(settings, color), ...patch } });
  };

  const handleRateChange = (color: string, value: string) => {
    setDrafts((d) => ({ ...d, [color]: value }));
    const parsed = Number(value);
    if (value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0) {
      setRule(color, { rate: parsed });
    }
  };

  const resetDefaults = () => {
    onChange({ ...DEFAULT_GOLD_SETTINGS });
    setDrafts(
      Object.fromEntries(
        TASK_COLORS.map((c) => [c.hex, String(DEFAULT_GOLD_SETTINGS[c.hex].rate)])
      )
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gold</DialogTitle>
          <DialogDescription>
            Earning colors pay out in whole {INTERVAL_MINUTES}-minute blocks.
            Spending colors drain gold continuously while the timer runs, and
            when it hits zero the timer stops. A rate of 0 makes a color
            neutral.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {TASK_COLORS.map((c) => {
            const rule = ruleFor(settings, c.hex);
            return (
              <div key={c.hex} className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-sm w-16">{colorLabel(c.hex)}</span>
                <Select
                  value={rule.mode}
                  onValueChange={(value) =>
                    setRule(c.hex, { mode: value as GoldRule["mode"] })
                  }
                >
                  <SelectTrigger
                    className="w-28"
                    aria-label={`${colorLabel(c.hex)} mode`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earn">Earn</SelectItem>
                    <SelectItem value="spend">Spend</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={drafts[c.hex] ?? String(rule.rate)}
                  onChange={(e) => handleRateChange(c.hex, e.target.value)}
                  onBlur={() =>
                    setDrafts((d) => ({ ...d, [c.hex]: String(rule.rate) }))
                  }
                  className="w-20"
                  aria-label={`${colorLabel(c.hex)} gold per ${INTERVAL_MINUTES} minutes`}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  gold / {INTERVAL_MINUTES}m
                </span>
              </div>
            );
          })}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={resetDefaults}>
            Reset to defaults
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GoldSettingsModal;
