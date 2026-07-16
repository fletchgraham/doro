import { useState, useEffect, useMemo, useRef } from "react";
import Countdown from "react-countdown";
import ActiveTaskView from "./components/ActiveTaskView";
import AllClear from "./components/AllClear";
import TasksView from "./components/TasksView";
import AddTaskModal from "./components/AddTaskModal";
import SwitchTaskModal from "./components/SwitchTaskModal";
import useTasks from "./hooks/useTasks";
import useTimer from "./hooks/useTimer";
import type Task from "./types/Task";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDuration } from "./lib/formatDuration";
import { getLiveDuration } from "./lib/getDuration";
import { Shuffle } from "lucide-react";

const makeDate = (mins: number) => Date.now() + mins * 60 * 1000;

const formatPausedFor = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  return formatDuration(ms);
};

const requestNotificationPermission = () => {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
};

const TASK_COLORS: Record<string, string> = {
  "#9ca3af": "Gray",
  "#f87171": "Red",
  "#fb923c": "Orange",
  "#facc15": "Yellow",
  "#4ade80": "Green",
  "#60a5fa": "Blue",
  "#c084fc": "Purple",
};

const DONUT_RADIUS = 40;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

// Donut of time share per color. Colors are the task colors themselves
// (they carry identity in the rest of the app), values live in the legend.
function ColorDonut({
  data,
  total,
}: {
  data: [string, number][];
  total: number;
}) {
  // 2px gap between segments so adjacent fills never touch
  const gap = data.length > 1 ? 2 : 0;
  const segments: Array<{
    color: string;
    duration: number;
    frac: number;
    start: number;
  }> = [];
  for (const [color, duration] of data) {
    const frac = duration / total;
    const prev = segments[segments.length - 1];
    const start = prev ? prev.start + prev.frac * DONUT_CIRCUMFERENCE : 0;
    segments.push({ color, duration, frac, start });
  }
  return (
    <div className="relative w-[140px] h-[140px]">
      <svg
        width="140"
        height="140"
        viewBox="0 0 140 140"
        role="img"
        aria-label="Share of time by task color"
      >
        {segments.map(({ color, duration, frac, start }) => {
          const len = Math.max(frac * DONUT_CIRCUMFERENCE - gap, 0);
          return (
            <circle
              key={color}
              cx="70"
              cy="70"
              r={DONUT_RADIUS}
              fill="none"
              stroke={color}
              strokeWidth="18"
              strokeDasharray={`${len} ${DONUT_CIRCUMFERENCE - len}`}
              strokeDashoffset={-(start + gap / 2)}
              transform="rotate(-90 70 70)"
            >
              <title>
                {`${TASK_COLORS[color] || color}: ${formatDuration(
                  duration
                )} (${Math.round(frac * 100)}%)`}
              </title>
            </circle>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold">{formatDuration(total)}</span>
      </div>
    </div>
  );
}

function App() {
  const [minsInput, setMinsInput] = useState("20");
  const parsedMins = Math.floor(Number(minsInput));
  const mins = Number.isFinite(parsedMins) && parsedMins >= 1 ? parsedMins : 1;
  const [date, setDate] = useState(() => makeDate(20));
  const [timerEpoch, setTimerEpoch] = useState(0);
  const pendingStartRef = useRef(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [isColorBreakdownOpen, setIsColorBreakdownOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pausedLong, setPausedLong] = useState(false);
  const [shuffleMode, setShuffleMode] = useState(
    () => localStorage.getItem("doroShuffleMode") === "true"
  );

  useEffect(() => {
    localStorage.setItem("doroShuffleMode", String(shuffleMode));
  }, [shuffleMode]);
  const taskManager = useTasks();
  const { isPaused, countdownRef, ...timer } = useTimer();

  // Give the countdown a fresh full duration, optionally starting it once
  // the new date prop has reached the Countdown (its componentDidUpdate
  // resets even a COMPLETED countdown). Starting synchronously would run
  // against the old — possibly already expired — date, which completes
  // immediately and re-rings the bell.
  const resetTimer = (autoStart: boolean) => {
    pendingStartRef.current = autoStart;
    setDate(makeDate(mins));
    setTimerEpoch((e) => e + 1);
  };

  useEffect(() => {
    if (pendingStartRef.current) {
      pendingStartRef.current = false;
      timer.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerEpoch]);

  const [tick, setTick] = useState(0);
  const [pausedElapsed, setPausedElapsed] = useState(0);
  const lastTimeRef = useRef("20:00");

  // Reflect running/paused state in the tab title so a glance at the
  // tab strip shows the timer state from another window
  useEffect(() => {
    document.title = `${isPaused ? "⏸" : "▶"} ${lastTimeRef.current} - Doro`;
  }, [isPaused]);

  // Track how long the timer has been paused
  useEffect(() => {
    if (!isPaused) {
      setPausedElapsed(0);
      return;
    }
    const since = Date.now();
    setPausedElapsed(0);
    const interval = setInterval(
      () => setPausedElapsed(Date.now() - since),
      1000
    );
    return () => clearInterval(interval);
  }, [isPaused]);

  // Tick every second while running to keep totals live
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const getTaskDuration = (task: Task) => {
    if (!isPaused && task.status === "active") {
      return getLiveDuration(task.events);
    }
    return task.duration;
  };

  // Use tick in dependency to force recalc while running
  const totalDuration = useMemo(() => {
    return taskManager.tasks.reduce((sum, t) => sum + getTaskDuration(t), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskManager.tasks, isPaused, tick]);

  const colorBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of taskManager.tasks) {
      const dur = getTaskDuration(task);
      if (dur <= 0) continue;
      const color = task.color || "#9ca3af";
      map.set(color, (map.get(color) || 0) + dur);
    }
    // Sort by duration descending
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskManager.tasks, isPaused, tick]);

  // Start pulsing the paused indicator after 2 minutes
  useEffect(() => {
    if (!isPaused) {
      setPausedLong(false);
      return;
    }
    const timeout = setTimeout(() => setPausedLong(true), 2 * 60 * 1000);
    return () => clearTimeout(timeout);
  }, [isPaused]);

  // Keyboard shortcuts for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === "a" && !isAddModalOpen && !isSwitchModalOpen) {
        e.preventDefault();
        setIsAddModalOpen(true);
      } else if (e.key === "s" && !isAddModalOpen && !isSwitchModalOpen) {
        e.preventDefault();
        setIsSwitchModalOpen(true);
      } else if (e.key === "Escape" && isColorBreakdownOpen) {
        setIsColorBreakdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAddModalOpen, isSwitchModalOpen, isColorBreakdownOpen]);

  // Paste handler to bulk add tasks when paused
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only when paused and not in an input
      if (!isPaused) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const text = e.clipboardData?.getData("text");
      if (!text) return;

      e.preventDefault();
      const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
      for (const line of lines) {
        taskManager.addTaskWithOptions(line, "ready", "bottom");
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isPaused, taskManager]);

  const activeTask = taskManager.getActiveTask();
  const workingCount = taskManager.getTasksByStatus("working").length;
  const readyCount = taskManager.getTasksByStatus("ready").length;
  // A task can be pulled in from working, or from ready when it's unlocked
  const hasNextCandidate =
    workingCount > 0 || (!taskManager.readyLocked && readyCount > 0);

  const handleAddTask = (
    text: string,
    status: Task["status"],
    position: "top" | "bottom",
    estimate?: number
  ) => {
    // If adding as active, handle timer state
    if (status === "active") {
      requestNotificationPermission();
      // Pause current active task if exists
      if (taskManager.getActiveTask()) {
        taskManager.logPause();
      }
      taskManager.addTaskWithOptions(text, status, position, estimate);
      taskManager.logStart();
      resetTimer(true);
    } else {
      taskManager.addTaskWithOptions(text, status, position, estimate);
    }
  };

  const handleReset = () => {
    timer.pauseAudio();
    resetTimer(false);
    timer.pause();
    taskManager.logPause();
    lastTimeRef.current = `${mins}:00`;
    document.title = `⏸ ${mins}:00 - Doro`;
  };

  const handleComplete = () => {
    timer.playAudio();
    taskManager.logPause();
    lastTimeRef.current = "0:00";
    document.title = "⏰ Time's up! - Doro";
    if (
      "Notification" in window &&
      Notification.permission === "granted" &&
      !document.hasFocus()
    ) {
      const active = taskManager.getActiveTask();
      new Notification("Doro — time's up", {
        body: active ? active.text : "Timer finished",
      });
    }
  };

  const handleContinue = () => {
    requestNotificationPermission();
    timer.pauseAudio();
    taskManager.logPause();
    taskManager.nextTask(shuffleMode);
    if (hasNextCandidate) {
      taskManager.logStart();
      resetTimer(true);
    } else {
      timer.pause();
    }
  };

  const handlePause = () => {
    timer.pauseAudio();
    timer.pause();
    taskManager.logPause();
  };

  const handleStart = () => {
    requestNotificationPermission();
    if (date <= Date.now()) {
      // The countdown already ran out; starting it as-is would just
      // re-ring the bell. Give it a fresh window instead.
      resetTimer(true);
    } else {
      timer.start();
    }
    taskManager.logStart();
  };

  const handleSwitchTask = (task: Task) => {
    requestNotificationPermission();
    // Pause current active task if exists
    if (taskManager.getActiveTask()) {
      taskManager.logPause();
    }
    // Set the selected task as active
    taskManager.setStatus(task, "active");
    taskManager.logStart();
    resetTimer(true);
  };

  const handleCreateAndStart = (text: string) => {
    requestNotificationPermission();
    // Pause current active task if exists
    if (taskManager.getActiveTask()) {
      taskManager.logPause();
    }
    taskManager.addTaskWithOptions(text, "active", "bottom");
    taskManager.logStart();
    resetTimer(true);
  };

  const handleDone = () => {
    timer.pauseAudio();
    taskManager.logPause();
    taskManager.completeTask();
    // completeTask will activate a successor iff one is available; the
    // local tasks array is still pre-dispatch here, so check candidates
    if (hasNextCandidate) {
      taskManager.logStart();
      resetTimer(true);
    } else {
      timer.pause();
    }
  };

  return (
    <main
      className="w-full max-w-2xl mx-auto px-4 py-8"
      onClick={() => setSelectedTaskId(null)}
    >
      <div className="flex items-center gap-2 mb-4">
        <Button onClick={() => setIsAddModalOpen(true)}>+ Add Task</Button>
        <Input
          type="number"
          min={1}
          value={minsInput}
          onChange={(e) => setMinsInput(e.target.value)}
          onBlur={() => setMinsInput(String(mins))}
          className="w-20"
        />
        <Button
          variant={shuffleMode ? "default" : "outline"}
          size="icon"
          onClick={() => setShuffleMode((s) => !s)}
          title={
            shuffleMode
              ? "Shuffle mode on: Next Task picks randomly"
              : "Shuffle mode off: Next Task picks in order"
          }
          aria-pressed={shuffleMode}
          aria-label="Toggle shuffle mode"
        >
          <Shuffle />
        </Button>
        <span
          className="ml-auto text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            if (totalDuration > 0) setIsColorBreakdownOpen(true);
          }}
          title="Click to see breakdown by color"
        >
          {formatDuration(totalDuration)} worked
        </span>
      </div>
      <h1
        className={cn(
          "text-5xl font-bold py-4 px-6 rounded-lg text-center",
          isPaused ? "bg-yellow-300 text-yellow-900" : "bg-green-300 text-green-900",
          pausedLong && "animate-pause-pulse"
        )}
      >
        <Countdown
          ref={countdownRef}
          autoStart={false}
          date={date}
          onComplete={handleComplete}
          onTick={({ hours, minutes, seconds }) => {
            const time = `${hours * 60 + minutes}:${seconds
              .toString()
              .padStart(2, "0")}`;
            lastTimeRef.current = time;
            document.title = `▶ ${time} - Doro`;
          }}
        />
        {isPaused && (
          <div className="text-base font-medium mt-1">
            paused for {formatPausedFor(pausedElapsed)}
          </div>
        )}
      </h1>
      <div className="flex gap-2 mt-4">
        {/* Start only makes sense with a task to work on; without one,
            Begin (which pulls a task in) is the way to get going */}
        {!isPaused ? (
          <Button onClick={handlePause}>Pause</Button>
        ) : (
          activeTask && <Button onClick={handleStart}>Start</Button>
        )}
        <Button variant="secondary" onClick={handleReset}>
          Reset
        </Button>
        <Button
          variant="secondary"
          onClick={handleContinue}
          disabled={!hasNextCandidate}
          title={
            hasNextCandidate
              ? undefined
              : taskManager.readyLocked && readyCount > 0
                ? "Ready list is locked — unlock it to pull in more tasks"
                : "No tasks available to pull in"
          }
        >
          {activeTask ? "Next Task >>" : "Begin"}
        </Button>
      </div>
      {!activeTask && workingCount === 0 ? (
        <AllClear
          readyCount={readyCount}
          readyLocked={taskManager.readyLocked}
        />
      ) : (
      <ActiveTaskView
        task={taskManager.getActiveTask()}
        isPaused={isPaused}
        onNotesChange={taskManager.setNotes}
        onTextChange={taskManager.setText}
        onUrlChange={taskManager.setUrl}
        onDurationOverride={taskManager.overrideDuration}
        onDone={taskManager.getActiveTask() ? handleDone : undefined}
        onDeactivate={
          isPaused && taskManager.getActiveTask()
            ? () => {
                const active = taskManager.getActiveTask();
                if (active) {
                  taskManager.logPause();
                  taskManager.setStatus(active, "working");
                }
              }
            : undefined
        }
      />
      )}
      {isPaused && (
        <TasksView
          taskManager={taskManager}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
        />
      )}
      <AddTaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddTask}
      />
      <SwitchTaskModal
        isOpen={isSwitchModalOpen}
        onClose={() => setIsSwitchModalOpen(false)}
        tasks={taskManager.tasks}
        onSwitch={handleSwitchTask}
        onCreate={handleCreateAndStart}
      />

      {/* Color breakdown modal */}
      {isColorBreakdownOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setIsColorBreakdownOpen(false)}
        >
          <div
            className="bg-background rounded-lg shadow-lg p-6 min-w-[280px] max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">Time by Color</h2>
            {colorBreakdown.length === 0 ? (
              <p className="text-muted-foreground text-sm">No time recorded yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <ColorDonut data={colorBreakdown} total={totalDuration} />
                </div>
                {colorBreakdown.map(([color, duration]) => (
                  <div key={color} className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm flex-1">
                      {TASK_COLORS[color] || color}
                    </span>
                    <span className="text-sm font-medium">
                      {formatDuration(duration)}
                    </span>
                    <span className="text-sm text-muted-foreground w-10 text-right">
                      {Math.round((duration / totalDuration) * 100)}%
                    </span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex items-center gap-3">
                  <div className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-semibold flex-1">Total</span>
                  <span className="text-sm font-semibold">
                    {formatDuration(totalDuration)}
                  </span>
                  <span className="text-sm text-muted-foreground w-10 text-right">
                    100%
                  </span>
                </div>
              </div>
            )}
            <Button
              className="mt-4 w-full"
              variant="secondary"
              onClick={() => setIsColorBreakdownOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
