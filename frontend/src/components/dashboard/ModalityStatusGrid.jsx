import { Scan, Mic, Type, Eye } from 'lucide-react'
import useStore from '../../store/useStore'
import { EMOTION_EMOJI, EMOTION_COLOR, pct } from '../../lib/emotions'
import clsx from 'clsx'

const MODALITIES = [
  { key: 'facialResult',  icon: Scan,  label: 'Facial' },
  { key: 'speechResult',  icon: Mic,   label: 'Speech' },
  { key: 'textResult',    icon: Type,  label: 'Text' },
  { key: 'microEvents',   icon: Eye,   label: 'Micro-Expr' },
]

export default function ModalityStatusGrid() {
  const store = useStore()

  return (
    <div className="grid grid-cols-2 gap-3">
      {MODALITIES.map(({ key, icon: Icon, label }) => {
        const result = store[key]
        const hasData = key === 'microEvents' ? result?.length > 0 : !!result
        const dominant = hasData && key !== 'microEvents' ? result.dominant : null
        const confidence = dominant
          ? result.scores?.find(s => s.emotion === dominant)?.confidence
          : null

        return (
          <div key={key} className={clsx('card p-4 flex flex-col gap-2 transition-colors', hasData && 'border-brand-500/30')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon size={14} className={hasData ? 'text-brand-400' : 'text-slate-600'} />
                <span className="label">{label}</span>
              </div>
              <div className={clsx('w-1.5 h-1.5 rounded-full', hasData ? 'bg-emerald-400' : 'bg-slate-600')} />
            </div>

            {hasData ? (
              key === 'microEvents' ? (
                <div className="text-2xl font-semibold text-orange-400">{result.length}</div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{EMOTION_EMOJI[dominant] ?? '—'}</span>
                  <div>
                    <div className="text-sm font-medium capitalize" style={{ color: EMOTION_COLOR[dominant] }}>
                      {dominant}
                    </div>
                    <div className="text-xs text-slate-500">{pct(confidence)}</div>
                  </div>
                </div>
              )
            ) : (
              <div className="text-xs text-slate-600">No data yet</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
