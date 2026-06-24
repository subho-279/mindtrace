import { EMOTION_COLOR, EMOTION_EMOJI, pct } from '../../lib/emotions'
import clsx from 'clsx'

export default function EmotionBar({ scores = [], dominant }) {
  const sorted = [...scores].sort((a, b) => b.confidence - a.confidence)

  return (
    <div className="space-y-2">
      {sorted.map(({ emotion, confidence }) => (
        <div key={emotion} className="flex items-center gap-2">
          <span className="text-base w-6 text-center">{EMOTION_EMOJI[emotion] ?? '❓'}</span>
          <span className={clsx(
            'w-20 text-xs font-medium capitalize',
            emotion === dominant ? 'text-white' : 'text-slate-400'
          )}>
            {emotion}
          </span>
          <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: pct(confidence),
                backgroundColor: EMOTION_COLOR[emotion] ?? '#94a3b8',
              }}
            />
          </div>
          <span className="w-10 text-right text-xs font-mono text-slate-500">
            {pct(confidence)}
          </span>
        </div>
      ))}
    </div>
  )
}
