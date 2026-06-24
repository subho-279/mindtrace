import { EMOTION_COLOR, EMOTION_EMOJI, EMOTION_BG } from '../../lib/emotions'

export default function DominantEmotionCard({ emotion, confidence, label = 'Dominant Emotion' }) {
  if (!emotion) return null
  const color = EMOTION_COLOR[emotion] ?? '#94a3b8'
  const bg    = EMOTION_BG[emotion]   ?? 'rgba(148,163,184,0.1)'

  return (
    <div
      className="card p-5 flex items-center gap-4"
      style={{ borderColor: color + '40', background: bg }}
    >
      <div className="text-5xl leading-none">{EMOTION_EMOJI[emotion] ?? '❓'}</div>
      <div>
        <div className="label mb-1">{label}</div>
        <div className="text-2xl font-semibold capitalize" style={{ color }}>
          {emotion}
        </div>
        {confidence != null && (
          <div className="text-sm text-slate-400 mt-0.5">
            {Math.round(confidence * 100)}% confidence
          </div>
        )}
      </div>
    </div>
  )
}
