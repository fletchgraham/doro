import { useState } from "react";
import "./App.css";
import Countdown from "react-countdown";
import ActiveTaskView from "./components/ActiveTaskView";
import TasksView from "./components/TasksView";
import useTasks from "./hooks/useTasks";
import useProjects from "./hooks/useProjects";
import useTimer from "./hooks/useTimer";

const makeDate = (mins: number) => Date.now() + mins * 60 * 1000;

function App() {
  const [mins, setMins] = useState(20);
  const [date, setDate] = useState(makeDate(mins));
  const taskManager = useTasks();
  const projectManager = useProjects();
  const { isPaused, countdownRef, ...timer } = useTimer();

  const handleReset = () => {
    timer.pauseAudio();
    setDate(makeDate(mins));
    timer.pause();
    taskManager.logPause();
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
    <main style={{ maxWidth: "32em", width: "100%" }}>
      <input
        value={mins}
        onChange={(e) => setMins(Number(e.target.value) | 0)}
      />
      <h1
        style={{
          backgroundColor: isPaused ? "yellow" : "lightgreen",
        }}
      >
        <Countdown
          ref={countdownRef}
          autoStart={false}
          date={date}
          onComplete={handleComplete}
        />
      </h1>
      {isPaused ? (
        <button onClick={handleStart}>Start</button>
      ) : (
        <button onClick={handlePause}>Pause</button>
      )}
      <button onClick={handleReset}>Reset</button>
      <button onClick={handleContinue}>
        {taskManager.getActiveTask() ? "Next Task >>" : "Begin"}
      </button>
      <ActiveTaskView
        task={taskManager.getActiveTask()}
        onNotesChange={taskManager.setNotes}
        onDone={taskManager.getActiveTask() ? handleDone : undefined}
        onDeactivate={
          isPaused && taskManager.getActiveTask()
            ? () => {
                const active = taskManager.getActiveTask();
                if (active) {
                  taskManager.setStatus(active, "working");
                }
              }
            : undefined
        }
      />
      {isPaused && (
        <TasksView taskManager={taskManager} projectManager={projectManager} />
      )}
    </main>
  );
}

export default App;
