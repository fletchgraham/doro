import { useState, useRef } from "react";
import "./App.css";

import Countdown from "react-countdown";

const makeDate = () => Date.now() + 3000;

function App() {
  const [date, setDate] = useState(makeDate());
  const [tasks, setTasks] = useState(["an important task", "another task"]);
  const [newTask, setNewTask] = useState("");

  const countdownRef = useRef<InstanceType<typeof Countdown>>(null);

  const handleReset = () => {
    setDate(makeDate());
    if (!countdownRef.current) return;
    countdownRef.current.getApi().start();
  };
  const handleComplete = () => {
    console.log("complete!");
  };

  return (
    <>
      <h1>
        <Countdown ref={countdownRef} date={date} onComplete={handleComplete} />
      </h1>
      <button onClick={handleReset}>Reset</button>
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
      {tasks.map((task, i) => {
        return (
          <p key={task}>
            <button onClick={() => setTasks(tasks.filter((t) => t !== task))}>
              X
            </button>{" "}
            {task}
          </p>
        );
      })}
    </>
  );
}

export default App;
