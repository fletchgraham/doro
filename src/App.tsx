import { useState, useEffect, useMemo, useRef } from "react";
import Countdown from "react-countdown";
import ActiveTaskView from "./components/ActiveTaskView";
import AllClear from "./components/AllClear";
import TasksView from "./components/TasksView";
import AddTaskModal from "./components/AddTaskModal";
import SwitchTaskModal from "./components/SwitchTaskModal";
import WorkflowyStatus from "./components/WorkflowyStatus";
import ColorGoals from "./components/ColorGoals";
import GoldSettingsModal from "./components/GoldSettingsModal";
import SettingsModal from "./components/SettingsModal";
import ProjectsPage from "./components/ProjectsPage";
import TemplatesPage from "./components/TemplatesPage";
import useTasks from "./hooks/useTasks";
import useTimer from "./hooks/useTimer";
import useTheme from "./hooks/useTheme";
import useProjects from "./hooks/useProjects";
import useTemplates, { TemplatesContext } from "./hooks/useTemplates";
import useSettings, { SettingsContext } from "./hooks/useSettings";
import useWorkflowySync from "./hooks/useWorkflowySync";
import useHashRoute, { routeHash, type Route } from "./hooks/useHashRoute";
import type Task from "./types/Task";
import type Subtask from "./types/Subtask";
import type { Project, ProjectTask } from "./types/Project";
import { dayTaskText, syncDayToProjects, syncProjectsToDay } from "./lib/projectSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDuration } from "./lib/formatDuration";
import { getLiveDuration, hasOpenSession } from "./lib/getDuration";
import { Coins, Settings, Shuffle } from "lucide-react";
import { DEFAULT_COLOR, colorLabel } from "./lib/taskColors";
import {
  computeGold,
  formatGold,
  isOutOfGold,
  isSpendingRule,
  liveGold,
  loadGoldSettings,
  msUntilBroke,
  saveGoldSettings,
} from "./lib/gold";

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
                {`${colorLabel(color)}: ${formatDuration(
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
  const [isGoldSettingsOpen, setIsGoldSettingsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [goldSettings, setGoldSettings] = useState(loadGoldSettings);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pausedLong, setPausedLong] = useState(false);
  const [shuffleMode, setShuffleMode] = useState(
    () => localStorage.getItem("doroShuffleMode") === "true"
  );

  useEffect(() => {
    localStorage.setItem("doroShuffleMode", String(shuffleMode));
  }, [shuffleMode]);
  useEffect(() => {
    saveGoldSettings(goldSettings);
  }, [goldSettings]);
  const taskManager = useTasks();
  const projectManager = useProjects();
  const templateManager = useTemplates();
  const { isPaused, countdownRef, ...timer } = useTimer();
  const { theme, setTheme } = useTheme();
  const settings = useSettings();
  const { features } = settings;
  const workflowySync = useWorkflowySync(
    taskManager,
    settings.workflowy,
    settings.setWorkflowy
  );
  const route = useHashRoute();
  const onProjectsPage = route === "projects";
  const onArchivePage = route === "archive";
  const onTemplatesPage = route === "templates";
  const onTimerPage = route === "timer";

  // Latest managers for the sync effects below, which must not re-run
  // just because App re-rendered and handed out fresh closures
  const taskManagerRef = useRef(taskManager);
  taskManagerRef.current = taskManager;
  const projectManagerRef = useRef(projectManager);
  projectManagerRef.current = projectManager;
  const timerRef = useRef(timer);
  timerRef.current = timer;

  // Day tasks pulled from a project share notes, subtasks and completion
  // with it.
  // Edits on the timer page are diffed against the previous render and
  // carried to the project task; only genuine changes dispatch, so the
  // mirror effect below finds nothing left to do.
  const prevTasksRef = useRef<Task[] | null>(null);
  useEffect(() => {
    const prev = prevTasksRef.current;
    prevTasksRef.current = taskManager.tasks;
    if (prev === null) return;
    const actions = syncDayToProjects(
      prev,
      taskManager.tasks,
      projectManagerRef.current.state
    );
    for (const action of actions) projectManagerRef.current.dispatch(action);
  }, [taskManager.tasks]);

  // The projects store is the source of truth: whenever it changes, the
  // linked day tasks follow (text incl. the project name, notes,
  // subtasks, done)
  useEffect(() => {
    const manager = taskManagerRef.current;
    const updates = syncProjectsToDay(projectManager.state, manager.tasks);
    for (const { task, text, notes, subtasks, done } of updates) {
      if (text !== undefined) manager.setText(task, text);
      if (notes !== undefined) manager.setNotes(task, notes);
      if (subtasks !== undefined) manager.setSubtasks(task, subtasks);
      if (done === true) {
        // Ticking off the task that's clocking time: stop the clock first
        if (task.status === "active") {
          timerRef.current.pauseAudio();
          timerRef.current.pause();
          manager.logPause();
        }
        manager.setStatus(task, "done");
      } else if (done === false) {
        manager.setStatus(task, "ready");
      }
    }
  }, [projectManager.state]);

  const handleAssignToday = (project: Project, projectTask: ProjectTask) => {
    taskManager.addProjectTask(
      dayTaskText(project.name, projectTask.text),
      projectTask.notes,
      projectTask.subtasks,
      projectTask.id
    );
  };

  // Taking a task off today only drops the day copy; the project keeps it
  const handleRemoveFromToday = (dayTask: Task) => {
    if (dayTask.status === "active") {
      timer.pauseAudio();
      timer.pause();
      taskManager.logPause();
    }
    taskManager.removeTask(dayTask);
  };

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
      const color = task.color || DEFAULT_COLOR;
      map.set(color, (map.get(color) || 0) + dur);
    }
    // Sort by duration descending
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskManager.tasks, isPaused, tick]);

  const progressByColor = useMemo(
    () => Object.fromEntries(colorBreakdown),
    [colorBreakdown]
  );

  const gold = useMemo(
    () => computeGold(progressByColor, goldSettings),
    [progressByColor, goldSettings]
  );

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
      const modalOpen =
        isAddModalOpen ||
        isSwitchModalOpen ||
        isGoldSettingsOpen ||
        isSettingsOpen;
      if (!onTimerPage) return;
      if (e.key === "a" && !modalOpen) {
        e.preventDefault();
        setIsAddModalOpen(true);
      } else if (e.key === "s" && !modalOpen) {
        e.preventDefault();
        setIsSwitchModalOpen(true);
      } else if (e.key === "Escape" && isColorBreakdownOpen) {
        setIsColorBreakdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isAddModalOpen,
    isSwitchModalOpen,
    isColorBreakdownOpen,
    isGoldSettingsOpen,
    isSettingsOpen,
    onTimerPage,
  ]);

  // Paste handler to bulk add tasks when paused
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only when paused, on the timer page, and not in an input
      if (!isPaused || !onTimerPage) return;
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
  }, [isPaused, taskManager, onTimerPage]);

  const activeTask = taskManager.getActiveTask();
  const activeColor = activeTask ? activeTask.color || DEFAULT_COLOR : undefined;
  const activeGoldRule = activeColor ? goldSettings[activeColor] : undefined;
  // On a spending task with nothing left to spend: the timer can't run,
  // only moving on to another task (or earning) gets things going again.
  // With the gold feature off, gold is neither shown nor enforced.
  const isBroke =
    features.gold && isSpendingRule(activeGoldRule) && isOutOfGold(gold);

  // Set right before forcing the countdown to zero so handleComplete can
  // tell an out-of-gold stop from a normal time's-up
  const outOfGoldRef = useRef(false);

  // While a spending task is clocking, stop it the instant gold hits zero.
  // Moving the countdown's date into the past completes it, which rings
  // the bell and logs the pause through the normal onComplete path.
  useEffect(() => {
    if (!features.gold) return;
    if (isPaused || !activeTask || !hasOpenSession(activeTask.events)) return;
    const msLeft = msUntilBroke(
      liveGold(taskManager.tasks, goldSettings),
      activeGoldRule
    );
    if (msLeft === null) return;
    const timeout = setTimeout(() => {
      outOfGoldRef.current = true;
      setDate(Date.now() - 1);
    }, msLeft);
    return () => clearTimeout(timeout);
  }, [
    features.gold,
    isPaused,
    activeTask,
    activeGoldRule,
    goldSettings,
    taskManager.tasks,
  ]);

  const workingCount = taskManager.getTasksByStatus("working").length;
  const readyCount = taskManager.getTasksByStatus("ready").length;
  // A task can be pulled in from working, or from ready when it's unlocked
  const hasNextCandidate =
    workingCount > 0 || (!taskManager.readyLocked && readyCount > 0);

  const handleAddTask = (
    text: string,
    status: Task["status"],
    position: "top" | "bottom",
    estimate?: number,
    subtasks?: Subtask[]
  ) => {
    // If adding as active, handle timer state
    if (status === "active") {
      requestNotificationPermission();
      // Pause current active task if exists
      if (taskManager.getActiveTask()) {
        taskManager.logPause();
      }
      taskManager.addTaskWithOptions(text, status, position, estimate, subtasks);
      taskManager.logStart();
      resetTimer(true);
    } else {
      taskManager.addTaskWithOptions(text, status, position, estimate, subtasks);
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
    const outOfGold = outOfGoldRef.current;
    outOfGoldRef.current = false;
    timer.playAudio();
    taskManager.logPause();
    lastTimeRef.current = "0:00";
    document.title = outOfGold
      ? "💰 Out of gold - Doro"
      : "⏰ Time's up! - Doro";
    if (
      "Notification" in window &&
      Notification.permission === "granted" &&
      !document.hasFocus()
    ) {
      const active = taskManager.getActiveTask();
      new Notification(outOfGold ? "Doro — out of gold" : "Doro — time's up", {
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

  const handleCreateAndStart = (text: string, subtasks?: Subtask[]) => {
    requestNotificationPermission();
    // Pause current active task if exists
    if (taskManager.getActiveTask()) {
      taskManager.logPause();
    }
    taskManager.addTaskWithOptions(text, "active", "bottom", undefined, subtasks);
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

  const navLink = (target: Route, label: string) => (
    <a
      href={routeHash[target]}
      className={cn(
        "px-3 py-1 rounded-md text-sm font-medium transition-colors",
        route === target
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
      aria-current={route === target ? "page" : undefined}
    >
      {label}
    </a>
  );

  return (
    <SettingsContext.Provider value={settings}>
    <TemplatesContext.Provider value={templateManager.templates}>
    <main
      className="w-full max-w-2xl mx-auto px-4 py-8"
      onClick={() => setSelectedTaskId(null)}
    >
      <nav className="flex items-center gap-1 mb-4" aria-label="Pages">
        {navLink("timer", "Timer")}
        {navLink("projects", "Projects")}
        {navLink("archive", "Archive")}
        {navLink("templates", "Templates")}
        {!onTimerPage && (
          <span className="ml-auto text-sm text-muted-foreground">
            {isPaused ? "⏸" : "▶"} {lastTimeRef.current}
          </span>
        )}
      </nav>
      {(onProjectsPage || onArchivePage) && (
        <ProjectsPage
          key={route}
          archive={onArchivePage}
          manager={projectManager}
          dayTasks={taskManager.tasks}
          onAssignToday={handleAssignToday}
          onRemoveFromToday={handleRemoveFromToday}
        />
      )}
      {onTemplatesPage && <TemplatesPage manager={templateManager} />}
      {/* The timer page stays mounted while on the other pages so the
          countdown and its effects keep running; it's just hidden */}
      <div hidden={!onTimerPage}>
      {features.goals && (
        <ColorGoals
          progress={progressByColor}
          isPaused={isPaused}
          activeColor={activeColor}
        />
      )}
      <div className="flex flex-wrap items-center gap-2 mb-4">
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
        {features.gold && (
        <button
          type="button"
          className="flex items-center gap-1 px-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setIsGoldSettingsOpen(true);
          }}
          title={
            isBroke
              ? "Out of gold — click to change gold rates"
              : "Gold — click to change earning and spending rates"
          }
          aria-label={`${formatGold(gold)} gold${isBroke ? ", out of gold" : ""}. Click to change gold rates`}
        >
          <Coins className="size-4 text-yellow-500" />
          <span
            data-testid="gold-readout"
            className={cn(
              isBroke && "text-red-600 dark:text-red-400 font-bold"
            )}
          >
            {formatGold(gold)}
          </span>
        </button>
        )}
        {/* Grouped so a narrow screen wraps them together, still right-aligned */}
        <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setIsSettingsOpen(true);
          }}
          title="Settings"
          aria-label="Open settings"
        >
          <Settings />
        </Button>
        <span
          className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
          onClick={(e) => {
            e.stopPropagation();
            if (totalDuration > 0) setIsColorBreakdownOpen(true);
          }}
          title="Click to see breakdown by color"
        >
          {formatDuration(totalDuration)} worked
        </span>
        </div>
      </div>
      <h1
        className={cn(
          "text-5xl font-bold py-4 px-6 rounded-lg text-center",
          isPaused
            ? "bg-yellow-300 text-yellow-900 dark:bg-yellow-400/20 dark:text-yellow-200"
            : "bg-green-300 text-green-900 dark:bg-green-400/20 dark:text-green-200",
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
          activeTask && !isBroke && <Button onClick={handleStart}>Start</Button>
        )}
        <Button
          variant="secondary"
          onClick={handleReset}
          disabled={isBroke}
          title={isBroke ? "Out of gold — move on to the next task" : undefined}
        >
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
        onAddSubtask={taskManager.addSubtask}
        onSubtaskTextChange={taskManager.setSubtaskText}
        onSubtaskDoneChange={taskManager.setSubtaskDone}
        onMoveSubtask={taskManager.moveSubtask}
        onRemoveSubtask={taskManager.removeSubtask}
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
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}
      {settings.workflowy.enabled && (
        <WorkflowyStatus
          sync={workflowySync}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}
      </div>
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
      <GoldSettingsModal
        isOpen={isGoldSettingsOpen}
        onClose={() => setIsGoldSettingsOpen(false)}
        settings={goldSettings}
        onChange={setGoldSettings}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        settings={settings}
        workflowySync={workflowySync}
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
                      {colorLabel(color)}
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
    </TemplatesContext.Provider>
    </SettingsContext.Provider>
  );
}

export default App;
