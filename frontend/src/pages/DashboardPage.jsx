import { useEffect } from 'react'
import useStore from '../store/useStore'
import { useSessionWS } from '../hooks/useSessionWS'
import EmotionTimeline from '../components/dashboard/EmotionTimeline'
import ModalityStatusGrid from '../components/dashboard/ModalityStatusGrid'
import DominantEmotionCard from '../components/shared/DominantEmotionCard'
import EmotionBar from '../components/shared/EmotionBar'
import { Activity, AlertTriangle } from 'lucide-react'

export default function DashboardPage() {
  const { sessionId, fusedResult, emotionTimeline, microEvents } = useStore()
  useSessionWS(sessionId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Live Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">
          Real-time multimodal emotion intelligence — all modalities feed here automatically.
        </p>
      </div>

      {!sessionId && (
        <div className="card p-6 text-center text-slate-400 text-sm">
          Start a new session using the button above, then use any modality tab to begin analysis.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Left: fused dominant + modality grid */}
        <div className="col-span-1 space-y-4">
          {fusedResult ? (
            <DominantEmotionCard
              emotion={fusedResult.dominant}
              confidence={fusedResult.confidence}
              label="Fused Prediction"
            />
          ) : (
            <div className="card p-5 text-center text-slate-500 text-sm">
              Run Fusion to see combined result
            </div>
          )}
          <ModalityStatusGrid />
        </div>

        {/* Center + Right: timeline */}
        <div className="col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={14} className="text-brand-400" />
              <span className="label">Emotion Timeline</span>
              <span className="ml-auto text-xs text-slate-500">{emotionTimeline.length} frames</span>
            </div>
            <EmotionTimeline timeline={emotionTimeline} />
          </div>

          {fusedResult && (
            <div className="card p-5">
              <div className="label mb-3">Fused Emotion Scores</div>
              <EmotionBar scores={fusedResult.scores} dominant={fusedResult.dominant} />
              <div className="mt-3 pt-3 border-t border-surface-border flex items-center gap-4 text-xs text-slate-500">
                <span>Strategy: <span className="text-slate-300">{fusedResult.fusion_strategy}</span></span>
                <span>Modalities: <span className="text-slate-300">{fusedResult.modalities_used?.join(', ')}</span></span>
              </div>
            </div>
          )}

          {microEvents?.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-orange-400" />
                <span className="label">Micro-Expression Alerts</span>
                <span className="ml-auto text-xs bg-orange-400/20 text-orange-400 px-2 py-0.5 rounded-full">
                  {microEvents.length} detected
                </span>
              </div>
              <div className="space-y-2">
                {microEvents.slice(0, 5).map((evt, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500 font-mono w-16">{evt.timestamp_ms}ms</span>
                    <span className="capitalize text-orange-300">{evt.suppressed_emotion}</span>
                    <span className="text-slate-500">{Math.round(evt.confidence * 100)}%</span>
                    <span className="text-slate-600">{evt.action_units?.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
