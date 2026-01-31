import { useState, useEffect } from "react";
import Countdown from "react-countdown";
import ActiveTaskView from "./components/ActiveTaskView";
import TasksView from "./components/TasksView";
import AddTaskModal from "./components/AddTaskModal";
import SwitchTaskModal from "./components/SwitchTaskModal";
import useTasks from "./hooks/useTasks";
import useProjects from "./hooks/useProjects";
import useTimer from "./hooks/useTimer";
import type Task from "./types/Task";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const makeDate = (mins: number) => Date.now() + mins * 60 * 1000;

function App() {
  const [mins, setMins] = useState(20);
  const [date, setDate] = useState(makeDate(mins));
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const taskManager = useTasks();
  const projectManager = useProjects();
  const { isPaused, countdownRef, ...timer } = useTimer();

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
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAddModalOpen, isSwitchModalOpen]);

  const handleAddTask = (
    text: string,
    status: Task["status"],
    position: "top" | "bottom"
  ) => {
    // If adding as active, handle timer state
    if (status === "active") {
      // Pause current active task if exists
      if (taskManager.getActiveTask()) {
        taskManager.logPause();
      }
      taskManager.addTaskWithOptions(text, status, position);
      taskManager.logStart();
      setDate(makeDate(mins));
      timer.start();
    } else {
      taskManager.addTaskWithOptions(text, status, position);
    }
  };

  const handleReset = () => {
    timer.pauseAudio();
    setDate(makeDate(mins));
    timer.pause();
    taskManager.logPause();
    document.title = `${mins}:00 - Doro`;
  };

  const handleComplete = () => {
    timer.playAudio();
    taskManager.logPause();
  };

  const handleContinue = () => {
    taskManager.logPause();
    taskManager.nextTask();
    taskManager.logStart();
    setDate(makeDate(mins));
    timer.start();
  };

  const handlePause = () => {
    timer.pause();
    taskManager.logPause();
  };

  const handleStart = () => {
    timer.start();
    taskManager.logStart();
  };

  const handleSwitchTask = (task: Task) => {
    // Pause current active task if exists
    if (taskManager.getActiveTask()) {
      taskManager.logPause();
    }
    // Set the selected task as active
    taskManager.setStatus(task, "active");
    taskManager.logStart();
    setDate(makeDate(mins));
    timer.start();
  };

  const handleCreateAndStart = (text: string) => {
    // Pause current active task if exists
    if (taskManager.getActiveTask()) {
      taskManager.logPause();
    }
    taskManager.addTaskWithOptions(text, "active", "bottom");
    taskManager.logStart();
    setDate(makeDate(mins));
    timer.start();
  };

  const handleDone = () => {
    taskManager.logPause();
    taskManager.completeTask();
    if (taskManager.getActiveTask()) {
      taskManager.logStart();
      setDate(makeDate(mins));
      timer.start();
    }
  };

  return (
    <main className="w-[32em] max-w-full">
      <div className="flex items-center gap-2 mb-4">
        <Button onClick={() => setIsAddModalOpen(true)}>+ Add Task</Button>
        <Input
          type="number"
          value={mins}
          onChange={(e) => setMins(Number(e.target.value) | 0)}
          className="w-20"
        />
      </div>
      <h1
        className={cn(
          "text-5xl font-bold py-4 px-6 rounded-lg text-center",
          isPaused ? "bg-yellow-300 text-yellow-900" : "bg-green-300 text-green-900"
        )}
      >
        <Countdown
          ref={countdownRef}
          autoStart={false}
          date={date}
          onComplete={handleComplete}
          onTick={({ minutes, seconds }) => {
            const time = `${minutes}:${seconds.toString().padStart(2, "0")}`;
            document.title = `${time} - Doro`;
          }}
        />
      </h1>
      <div className="flex gap-2 mt-4">
        {isPaused ? (
          <Button onClick={handleStart}>Start</Button>
        ) : (
          <Button onClick={handlePause}>Pause</Button>
        )}
        <Button variant="secondary" onClick={handleReset}>
          Reset
        </Button>
        <Button variant="secondary" onClick={handleContinue}>
          {taskManager.getActiveTask() ? "Next Task >>" : "Begin"}
        </Button>
      </div>
      <ActiveTaskView
        task={taskManager.getActiveTask()}
        onNotesChange={taskManager.setNotes}
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
      {isPaused && (
        <TasksView taskManager={taskManager} projectManager={projectManager} />
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
    </main>
  );
}

export default App;
