import { useRef, useState } from "react";
import Countdown from "react-countdown";
import timerAudio from "./../assets/kitchen-timer-33043.mp3";

const useTimer = () => {
  const countdownRef = useRef<InstanceType<typeof Countdown>>(null);
  const audioRef = useRef(new Audio(timerAudio));
  const [isPaused, setIsPaused] = useState(true);

  const playAudio = () => {
    audioRef.current.play();
  };

  const pauseAudio = () => {
    audioRef.current.pause();
  };

  const start = () => {
    countdownRef.current?.getApi().start();
    setIsPaused(false);
  };

  const pause = () => {
    countdownRef.current?.getApi().pause();
    setIsPaused(true);
  };

  const stop = () => {
    countdownRef.current?.getApi().stop();
  };

  return {
    audioRef,
    countdownRef,
    isPaused,
    start,
    stop,
    pause,
    playAudio,
    pauseAudio,
  };
};

export default useTimer;
