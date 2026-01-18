import { useState, useRef } from "react";
import "./App.css";
import timerAudio from "./../public/kitchen-timer-33043.mp3";

import Countdown from "react-countdown";

import useTasks from "./hooks/useTasks";

const makeDate = () => Date.now() + 1 * 5 * 1000;

function App() {
  const [date, setDate] = useState(makeDate());
  const { tasks, curTask, addTask, removeTask, nextTask } = useTasks();
  const [newTask, setNewTask] = useState("");

  const countdownRef = useRef<InstanceType<typeof Countdown>>(null);
  const audioRef = useRef(new Audio(timerAudio));

  const handleReset = () => {
    audioRef.current.pause();
    setDate(makeDate());
    countdownRef.current?.getApi().pause();
  };

  const handleComplete = () => {
    console.log("complete!");
    audioRef.current.play();
  };

  const handleContinue = () => {
    audioRef.current.pause();
    nextTask();
    setDate(makeDate());
    if (!countdownRef.current) return;
    countdownRef.current.getApi().start();
    console.log("continue!");
  };

  const handleAddTask = () => {
    addTask(newTask);
    setNewTask("");
  };

  return (
    <main style={{ width: "25em" }}>
      <h1>
        <Countdown
          ref={countdownRef}
          autoStart={false}
          date={date}
          onComplete={handleComplete}
        />
      </h1>
      <h2>{curTask}</h2>
      <button onClick={handleReset}>Reset</button>
      <button onClick={handleContinue}>Continue</button>
      <ul>
        {tasks.map((task) => {
          return (
            <li key={task}>
              <button onClick={() => removeTask(task)}>X</button> {task}
            </li>
          );
        })}
      </ul>
      <div>
        <input value={newTask} onChange={(e) => setNewTask(e.target.value)} />
        <button disabled={newTask.length === 0} onClick={handleAddTask}>
          Add
        </button>
      </div>
    </main>
  );
}

export default App;
