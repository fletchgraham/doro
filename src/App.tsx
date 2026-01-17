import { useState, useRef } from "react";
import "./App.css";
import timerAudio from "./../public/kitchen-timer-33043.mp3";

import Countdown from "react-countdown";

const makeDate = () => Date.now() + 1 * 5 * 1000;

function App() {
  const [date, setDate] = useState(makeDate());
  const [tasks, setTasks] = useState(["an important task", "another task"]);
  const [newTask, setNewTask] = useState("");
  const [curTask, setCurTask] = useState<string | null>(null);

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
    setCurTask(tasks[0]);

    if (curTask) {
      setTasks([...tasks.slice(1), curTask]);
    } else {
      setTasks([...tasks.slice(1)]);
    }

    setDate(makeDate());
    if (!countdownRef.current) return;
    countdownRef.current.getApi().start();
    console.log("continue!");
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
        {tasks.map((task, i) => {
          return (
            <li key={task}>
              <button onClick={() => setTasks(tasks.filter((t) => t !== task))}>
                X
              </button>{" "}
              {task}
            </li>
          );
        })}
      </ul>
      <div>
        <input value={newTask} onChange={(e) => setNewTask(e.target.value)} />
        <button
          disabled={newTask.length === 0}
          onClick={() => {
            setTasks([...tasks, newTask]);
            setNewTask("");
          }}
        >
          Add
        </button>
      </div>
    </main>
  );
}

export default App;
