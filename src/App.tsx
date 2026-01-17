import { useState } from "react";
import "./App.css";

import Countdown from "react-countdown";

function App() {
  const [count, setCount] = useState(0);
  const [date, setDate] = useState(Date.now() + 20 * 60000);

  const handleReset = () => setDate(Date.now() + 20 * 60000);

  return (
    <>
      <h1>
        <Countdown date={date} />
      </h1>
      <p>Some very important task.</p>
      <div className="card">
        <button onClick={handleReset}>Reset</button>
      </div>
    </>
  );
}

export default App;
