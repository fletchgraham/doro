import { useRef } from "react";
import Countdown from "react-countdown";
import timerAudio from "./../assets/kitchen-timer-33043.mp3";

const useTimer = () => {
  const countdownRef = useRef<InstanceType<typeof Countdown>>(null);
  const audioRef = useRef(new Audio(timerAudio));

  const playAudio = () => {
    audioRef.current.play();
  };

  const pauseAudio = () => {
    audioRef.current.pause();
  };

  const start = () => {
    countdownRef.current?.getApi().start();
  };

  const stop = () => {
    countdownRef.current?.getApi().pause();
  };

  return { audioRef, countdownRef, start, stop, playAudio, pauseAudio };
};

export default useTimer;
