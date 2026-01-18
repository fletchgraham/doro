import { useRef } from "react";
import Countdown from "react-countdown";
import timerAudio from "./../assets/kitchen-timer-33043.mp3";

const useTimer = () => {
  const countdownRef = useRef<InstanceType<typeof Countdown>>(null);
  const audioRef = useRef(new Audio(timerAudio));

  return { audioRef, countdownRef };
};

export default useTimer;
