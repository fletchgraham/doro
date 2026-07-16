// Lightweight canvas confetti burst — no dependencies. Fires a short
// celebration from the given screen point (defaults to viewport center).

const COLORS = [
  "#f87171",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#60a5fa",
  "#c084fc",
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  // 0 = rectangle, 1 = circle
  shape: number;
  wobble: number;
  wobbleSpeed: number;
}

const DURATION_MS = 1600;
const GRAVITY = 0.12;
const DRAG = 0.99;

export function fireConfetti(originX?: number, originY?: number) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999";
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  document.body.appendChild(canvas);

  const x = originX ?? window.innerWidth / 2;
  const y = originY ?? window.innerHeight / 2;

  const particles: Particle[] = Array.from({ length: 90 }, () => {
    // Bias the burst upward in a wide fan
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
    const speed = 4 + Math.random() * 8;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
      shape: Math.random() < 0.7 ? 0 : 1,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.1 + Math.random() * 0.1,
    };
  });

  const start = performance.now();

  const frame = (now: number) => {
    const elapsed = now - start;
    if (elapsed > DURATION_MS) {
      canvas.remove();
      return;
    }

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const fade = 1 - Math.max(0, (elapsed - DURATION_MS * 0.6) / (DURATION_MS * 0.4));

    for (const p of particles) {
      p.vy += GRAVITY;
      p.vx *= DRAG;
      p.vy *= DRAG;
      p.wobble += p.wobbleSpeed;
      p.x += p.vx + Math.sin(p.wobble) * 0.6;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.shape === 0) {
        // Squish rectangles as they tumble for a paper-flutter feel
        ctx.fillRect(
          -p.size / 2,
          (-p.size / 2) * 0.6,
          p.size,
          p.size * 0.6 * Math.abs(Math.cos(p.wobble))
        );
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}
