import { useState } from 'react'
import { GitMerge, Loader2, CheckCircle } from 'lucide-react'
import useStore from '../store/useStore'
import { fuseSession } from '../lib/api'
import EmotionBar from '../components/shared/EmotionBar'
import DominantEmotionCard from '../components/shared/DominantEmotionCard'
import { fmtMs } from '../lib/emotions'

const STRATEGIES = [
  { id: 'late', label: 'Late Fusion', desc: 'Confidence-weighted voting — best for mixed modalities' },
  { id: 'early', label: 'Early Fusion', desc: 'Feature averaging — best when all modalities present' },
  { id: 'attention', label: 'Attention Fusion', desc: 'Cross-modal transformer weighting' },
]

export default function FusionPage() {
  const { sessionId, fusedResult, setFusedResult, facialResult, speechResult, textResult, microEvents } = useStore()
  const [strategy, setStrategy] = useState('late')
  const [loading, setLoading]   = useState(false)

  const available = [
    facialResult && 'facial',
    speechResult && 'speech',
    textResult   && 'text',
    microEvents?.length > 0 && 'micro',
  ].filter(Boolean)

  const handleFuse = async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const { data } = await fuseSession(sessionId, strategy)
      setFusedResult(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Multimodal Fusion</h1>
        <p className="text-sm text-slate-400 mt-1">Combine facial, speech, text, and micro-expression predictions</p>
      </div>

      {!sessionId && (
        <div className="card p-4 text-sm text-amber-400 border-amber-400/30">
          Please create a session first.
        </div>
      )}

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 space-y-4">
          {/* Modality availability */}
          <div className="card p-4">
            <div className="label mb-3">Available Modalities</div>
            <div className="grid grid-cols-2 gap-2">
              {['facial', 'speech', 'text', 'micro'].map(mod => {
                const ready = available.includes(mod)
                return (
                  <div key={mod} className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${
                    ready ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-surface border border-surface-border'
                  }`}>
                    <CheckCircle size={14} className={ready ? 'text-emerald-400' : 'text-slate-600'} />
                    <span className={`capitalize ${ready ? 'text-slate-200' : 'text-slate-500'}`}>{mod}</span>
                  </div>
                )
              })}
            </div>
            {available.length === 0 && (
              <p className="text-xs text-slate-500 mt-2">
                Run at least one modality analysis before fusing.
              </p>
            )}
          </div>

          {/* Strategy selection */}
          <div className="card p-4 space-y-2">
            <div className="label mb-1">Fusion Strategy</div>
            {STRATEGIES.map(s => (
              <button
                key={s.id}
                onClick={() => setStrategy(s.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  strategy === s.id
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-surface-border hover:border-brand-500/40 hover:bg-surface-hover'
                }`}
              >
                <div className={`text-sm font-medium ${strategy === s.id ? 'text-brand-400' : 'text-slate-200'}`}>
                  {s.label}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{s.desc}</div>
              </button>
            ))}
          </div>

          <button
            onClick={handleFuse}
            disabled={available.length === 0 || !sessionId || loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
            {loading ? 'Fusing…' : 'Run Fusion'}
          </button>
        </div>

        <div className="col-span-2 space-y-3">
          {fusedResult ? (
            <>
              <DominantEmotionCard
                emotion={fusedResult.dominant}
                confidence={fusedResult.confidence}
                label="Fused Prediction"
              />
              <div className="card p-4">
                <div className="label mb-3">Fused Emotion Scores</div>
                <EmotionBar scores={fusedResult.scores} dominant={fusedResult.dominant} />
              </div>
              <div className="card p-4 text-xs space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="label mb-1">Strategy</div>
                    <div className="text-slate-300 capitalize">{fusedResult.fusion_strategy}</div>
                  </div>
                  <div>
                    <div className="label mb-1">Processing</div>
                    <div className="text-slate-300">{fmtMs(fusedResult.processing_ms)}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="label mb-1">Modalities Used</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {fusedResult.modalities_used?.map(m => (
                        <span key={m} className="px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 text-xs capitalize">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {fusedResult.micro_alerts?.length > 0 && (
                <div className="card p-4 text-xs">
                  <div className="label mb-2">Micro-Expression Alerts in Fusion</div>
                  <div className="text-orange-400">{fusedResult.micro_alerts.length} suppression events detected</div>
                </div>
              )}
            </>
          ) : (
            <div className="card p-6 text-center text-slate-500 text-sm">
              Run analysis on at least one modality, then click Run Fusion
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
