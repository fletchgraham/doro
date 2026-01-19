import { useState } from "react";
import "./App.css";
import Countdown from "react-countdown";
import TasksView from "./components/TasksView";
import useTasks from "./hooks/useTasks";
import useTimer from "./hooks/useTimer";

const makeDate = (mins: number) => Date.now() + mins * 60 * 1000;

function App() {
  const [mins, setMins] = useState(20);
  const [date, setDate] = useState(makeDate(mins));
  const taskManager = useTasks();
  const timer = useTimer();

  const handleReset = () => {
    timer.pauseAudio();
    setDate(makeDate(mins));
    timer.pause();
  };

  const handleComplete = () => {
    timer.playAudio();
  };

  const handleContinue = () => {
    taskManager.nextTask();
    setDate(makeDate(mins));
    timer.start();
  };

  return (
    <main style={{ width: "25em" }}>
      <input
        value={mins}
        onChange={(e) => setMins(Number(e.target.value) | 0)}
      />
      <h1
        style={{
          backgroundColor: timer.isPaused ? "yellow" : "lightgreen",
        }}
      >
        <Countdown
          ref={timer.countdownRef}
          autoStart={false}
          date={date}
          onComplete={handleComplete}
        />
      </h1>
      {timer.isPaused ? (
        <button onClick={timer.start}>Start</button>
      ) : (
        <button onClick={timer.pause}>Pause</button>
      )}
      <button onClick={handleReset}>Reset</button>
      <button onClick={handleContinue}>
        {taskManager.curTask ? "Next Task >>" : "Begin"}
      </button>
      <TasksView taskManager={taskManager} />
    </main>
  );
}

export default App;
