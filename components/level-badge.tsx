import { getLevel, ETEC_LEVELS } from "@/lib/demo-data";

interface LevelBadgeProps {
  score: number;
  total: number;
  showScore?: boolean;
}

export function LevelBadge({ score, total, showScore = false }: LevelBadgeProps) {
  const level = getLevel(score, total);
  const config = ETEC_LEVELS[level as keyof typeof ETEC_LEVELS];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text} ${config.border} border`}
    >
      {level}
      {showScore && <span className="opacity-70">({score}/{total})</span>}
    </span>
  );
}
