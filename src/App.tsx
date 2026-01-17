import { useState } from "react";
import "./App.css";

import Countdown from "react-countdown";

function App() {
  const [date, setDate] = useState(Date.now() + 20 * 60000);
  const handleReset = () => setDate(Date.now() + 20 * 60000);
  const [tasks, setTasks] = useState(["an important task", "another task"]);

  return (
    <>
      <h1>
        <Countdown date={date} />
      </h1>
      <button onClick={handleReset}>Reset</button>
      {tasks.map((task) => {
        return <p key={task}>{task}</p>;
      })}
    </>
  );
}

export default App;
