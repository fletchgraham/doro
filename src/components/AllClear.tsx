// Celebratory empty state shown when there's nothing left to work on,
// in the spirit of GitHub's "nothing to review" zen graphic.

const RAY_COLORS = [
  "#f87171",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#60a5fa",
  "#c084fc",
];

function AllClear({
  readyCount,
  readyLocked,
}: {
  readyCount: number;
  readyLocked: boolean;
}) {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const inner = i % 2 === 0 ? 46 : 42;
    const outer = i % 2 === 0 ? 60 : 52;
    return {
      x1: 70 + Math.cos(angle) * inner,
      y1: 70 + Math.sin(angle) * inner,
      x2: 70 + Math.cos(angle) * outer,
      y2: 70 + Math.sin(angle) * outer,
      color: RAY_COLORS[i % RAY_COLORS.length],
    };
  });

  return (
    <div className="mt-6 py-10 rounded-lg border border-dashed flex flex-col items-center text-center gap-3">
      <svg
        width="140"
        height="140"
        viewBox="0 0 140 140"
        aria-hidden="true"
        className="animate-all-clear-float"
      >
        {rays.map((ray, i) => (
          <line
            key={i}
            x1={ray.x1}
            y1={ray.y1}
            x2={ray.x2}
            y2={ray.y2}
            stroke={ray.color}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        ))}
        <circle cx="70" cy="70" r="34" fill="#4ade80" opacity="0.18" />
        <circle
          cx="70"
          cy="70"
          r="26"
          fill="none"
          stroke="#4ade80"
          strokeWidth="4"
        />
        <path
          d="M58 71 L66 79 L83 61"
          fill="none"
          stroke="#4ade80"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <h2 className="text-2xl font-semibold">No more tasks</h2>
      <p className="text-muted-foreground text-sm max-w-xs">
        {readyCount > 0
          ? readyLocked
            ? `You've cleared the working batch. ${readyCount} task${
                readyCount === 1 ? "" : "s"
              } waiting in Ready (locked).`
            : `Nothing in Working. ${readyCount} task${
                readyCount === 1 ? "" : "s"
              } waiting in Ready.`
          : "You've worked it all down to zero. Enjoy the calm."}
      </p>
    </div>
  );
}

export default AllClear;
