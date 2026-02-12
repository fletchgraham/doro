import { useEffect, useRef, useState } from "react";
import Countdown from "react-countdown";
import timerAudioUrl from "./../assets/kitchen-timer-33043.mp3";

const useTimer = () => {
  const countdownRef = useRef<InstanceType<typeof Countdown>>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const [isPaused, setIsPaused] = useState(true);

  useEffect(() => {
    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    fetch(timerAudioUrl)
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        audioBufferRef.current = decoded;
      });

    return () => {
      ctx.close();
    };
  }, []);

  const playAudio = () => {
    const ctx = audioContextRef.current;
    const buffer = audioBufferRef.current;
    if (!ctx || !buffer) return;

    // Stop any existing playback first
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // Already stopped
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(ctx.destination);
    source.start();
    sourceNodeRef.current = source;
  };

  const pauseAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // Already stopped
      }
      sourceNodeRef.current = null;
    }
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
