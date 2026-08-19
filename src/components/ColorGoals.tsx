import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/formatDuration";
import { parseTime } from "@/lib/parseTime";
import { TASK_COLORS, colorLabel } from "@/lib/taskColors";
import {
  goalBarFractions,
  loadGoals,
  type ColorGoal,
} from "@/lib/colorGoals";

function GoalBar({
  goal,
  worked,
  onRemove,
}: {
  goal: ColorGoal;
  worked: number;
  onRemove?: () => void;
}) {
  const { fill, over } = goalBarFractions(worked, goal.target);
  const overMs = Math.max(worked - goal.target, 0);
  return (
    <div className="group flex items-center gap-2">
      <div className="relative flex-1 h-6 rounded-md bg-muted overflow-hidden">
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${fill * 100}%`, backgroundColor: goal.color }}
        />
        {over > 0 && (
          <div
            className="absolute inset-y-0 right-0 bg-red-500"
            style={{ width: `${over * 100}%` }}
            title={`${formatDuration(overMs)} over goal`}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-medium text-gray-900">
          <span>{colorLabel(goal.color)}</span>
          <span>
            {formatDuration(worked)} / {formatDuration(goal.target)}
            {overMs > 0 && (
              <span className="font-bold text-red-950">
                {" "}
                +{formatDuration(overMs)}
              </span>
            )}
          </span>
        </div>
      </div>
      {onRemove ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onRemove}
          aria-label={`Remove ${colorLabel(goal.color)} goal`}
        >
          <Minus />
        </Button>
      ) : (
        <div className="w-6 shrink-0" />
      )}
    </div>
  );
}

export default function ColorGoals({
  progress,
  isPaused,
  activeColor,
}: {
  progress: Record<string, number>;
  isPaused: boolean;
  activeColor?: string;
}) {
  const [goals, setGoals] = useState<ColorGoal[]>(loadGoals);
  const [isAdding, setIsAdding] = useState(false);
  const [newColor, setNewColor] = useState<string | null>(null);
  const [timeInput, setTimeInput] = useState("");

  useEffect(() => {
    localStorage.setItem("doroColorGoals", JSON.stringify(goals));
  }, [goals]);

  // Only one goal per color, so offer just the colors without one
  const availableColors = TASK_COLORS.filter(
    (c) => !goals.some((g) => g.color === c.hex)
  );

  // While the timer runs, only the active task's color matters
  const visibleGoals = isPaused
    ? goals
    : goals.filter((g) => g.color === activeColor);

  if (visibleGoals.length === 0 && !isPaused) return null;

  const parsedTime = parseTime(timeInput);
  const canAdd = newColor !== null && parsedTime !== null && parsedTime > 0;

  const addGoal = () => {
    if (!canAdd || newColor === null || parsedTime === null) return;
    setGoals([...goals, { color: newColor, target: parsedTime }]);
    setIsAdding(false);
    setNewColor(null);
    setTimeInput("");
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setNewColor(null);
    setTimeInput("");
  };

  return (
    <div className="group/goals mb-4 space-y-1">
      {visibleGoals.map((goal) => (
        <GoalBar
          key={goal.color}
          goal={goal}
          worked={progress[goal.color] || 0}
          onRemove={
            isPaused
              ? () => setGoals(goals.filter((g) => g.color !== goal.color))
              : undefined
          }
        />
      ))}
      {isPaused &&
        (isAdding ? (
          <div
            className="flex items-center gap-2 flex-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5">
              {availableColors.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={cn(
                    "w-5 h-5 rounded-full transition-transform hover:scale-110",
                    newColor === c.hex && "ring-2 ring-ring ring-offset-2"
                  )}
                  style={{ backgroundColor: c.hex }}
                  onClick={() => setNewColor(c.hex)}
                  aria-label={colorLabel(c.hex)}
                  aria-pressed={newColor === c.hex}
                />
              ))}
            </div>
            <Input
              autoFocus
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addGoal();
                if (e.key === "Escape") cancelAdd();
              }}
              placeholder="1h 30m"
              className="w-24 h-8"
              aria-label="Goal time"
            />
            <Button size="sm" onClick={addGoal} disabled={!canAdd}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelAdd}>
              Cancel
            </Button>
          </div>
        ) : (
          availableColors.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6 text-muted-foreground",
                // Keep the button discoverable when there's nothing to hover
                goals.length > 0 &&
                  "opacity-0 group-hover/goals:opacity-100 focus-visible:opacity-100 transition-opacity"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setIsAdding(true);
              }}
              aria-label="Add color goal"
              title="Add a goal for a color"
            >
              <Plus />
            </Button>
          )
        ))}
    </div>
  );
}
