import { scoreColor } from "@/lib/iteration"

export const SCORE_LABELS: Record<string, { label: string; description: string }> = {
  C: { label: "Clarity", description: "How clear and unambiguous is this prompt?" },
  F: { label: "Feasibility", description: "How actionable and achievable is this?" },
  N: { label: "Novelty", description: "How creative or original is the approach?" },
  R: { label: "Relevance", description: "How well does it address the original goal?" },
}

export function ScoreBadge({ scoreKey, value }: { scoreKey: string; value: number }) {
  const info = SCORE_LABELS[scoreKey]
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full bg-muted ${scoreColor(value)}`}
      title={info?.description}
    >
      {info?.label ?? scoreKey} {value}
    </span>
  )
}

export function ScoreRow({ score }: { score: { C: number; F: number; N: number; R: number } }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <ScoreBadge scoreKey="C" value={score.C} />
      <ScoreBadge scoreKey="F" value={score.F} />
      <ScoreBadge scoreKey="N" value={score.N} />
      <ScoreBadge scoreKey="R" value={score.R} />
    </div>
  )
}
