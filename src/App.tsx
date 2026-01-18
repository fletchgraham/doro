import { useState } from "react";
import "./App.css";
import Countdown from "react-countdown";
import useTasks from "./hooks/useTasks";
import useTimer from "./hooks/useTimer";

const makeDate = (mins: number) => Date.now() + 1 * 5 * 1000;

function App() {
  const [mins, setMins] = useState(20);
  const [date, setDate] = useState(makeDate(mins));
  const taskManager = useTasks();
  const { audioRef, countdownRef } = useTimer();

  const handleReset = () => {
    audioRef.current.pause();
    setDate(makeDate(mins));
    countdownRef.current?.getApi().pause();
  };

  const handleComplete = () => {
    console.log("complete!");
    audioRef.current.play();
  };

  const handleContinue = () => {
    audioRef.current.pause();
    taskManager.nextTask();
    setDate(makeDate(mins));
    if (!countdownRef.current) return;
    countdownRef.current.getApi().start();
    console.log("continue!");
  };

  return (
    <main style={{ width: "25em" }}>
      <input
        value={mins}
        onChange={(e) => setMins(Number(e.target.value) | 0)}
      />
      <h1>
        <Countdown
          ref={countdownRef}
          autoStart={false}
          date={date}
          onComplete={handleComplete}
        />
      </h1>
      <button onClick={handleReset}>Reset</button>
      <button onClick={handleContinue}>Continue</button>
      <Tasks taskManager={taskManager} />
    </main>
  );
}

function Tasks({
  taskManager,
}: {
  taskManager: {
    tasks: string[];
    curTask: string | null;
    addTask: CallableFunction;
    removeTask: CallableFunction;
  };
}) {
  const [newTask, setNewTask] = useState("");

  const handleAddTask = () => {
    taskManager.addTask(newTask);
    setNewTask("");
  };

  return (
    <>
      <h2>{taskManager.curTask}</h2>
      <ul>
        {taskManager.tasks.map((task) => {
          return (
            <li key={task}>
              <button onClick={() => taskManager.removeTask(task)}>X</button>{" "}
              {task}
            </li>
          );
        })}
      </ul>
      <div>
        <form>
          <input value={newTask} onChange={(e) => setNewTask(e.target.value)} />
          <button
            type="submit"
            disabled={newTask.length === 0}
            onClick={handleAddTask}
          >
            Add
          </button>
        </form>
      </div>
    </>
  );
}

export default App;
