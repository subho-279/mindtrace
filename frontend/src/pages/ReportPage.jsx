import { useState } from 'react'
import { FileText, Loader2, RefreshCw, CheckCircle, AlertCircle, Info } from 'lucide-react'
import useStore from '../store/useStore'
import { generateReport } from '../lib/api'
import { EMOTION_EMOJI, EMOTION_COLOR } from '../lib/emotions'

export default function ReportPage() {
  const { sessionId, fusedResult, report, setReport } = useStore()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const handleGenerate = async () => {
    if (!sessionId) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await generateReport(sessionId)
      setReport(data)
    } catch (e) {
      setError(e.response?.data?.detail ?? e.message)
    } finally {
      setLoading(false)
    }
  }

  const wellness = report?.wellness_indicators ?? {}
  const stressColor  = { low: 'emerald', moderate: 'amber', high: 'red' }
  const regColor     = { stable: 'emerald', fluctuating: 'amber', dysregulated: 'red' }
  const authColor    = { congruent: 'emerald', mixed: 'amber', incongruent: 'orange' }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Behavioral Report</h1>
          <p className="text-sm text-slate-400 mt-1">
            AI-generated narrative powered by Anthropic Claude
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!sessionId || !fusedResult || loading}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {report ? 'Regenerate' : 'Generate Report'}
        </button>
      </div>

      {!fusedResult && (
        <div className="card p-4 flex items-center gap-3 text-sm border-amber-400/30">
          <Info size={16} className="text-amber-400 flex-shrink-0" />
          <span className="text-amber-300">Run Fusion first to enable report generation.</span>
        </div>
      )}

      {error && (
        <div className="card p-4 flex items-center gap-3 text-sm border-red-500/30">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
          <span className="text-red-300">{error}</span>
        </div>
      )}

      {report ? (
        <div className="space-y-4">
          {/* Header card */}
          <div className="card p-5 flex items-center gap-4"
            style={{ borderColor: (EMOTION_COLOR[report.dominant_emotion] ?? '#4f6ef7') + '40' }}>
            <div className="text-5xl">{EMOTION_EMOJI[report.dominant_emotion] ?? '🧠'}</div>
            <div>
              <div className="label mb-1">Dominant Emotional State</div>
              <div className="text-2xl font-semibold capitalize" style={{ color: EMOTION_COLOR[report.dominant_emotion] }}>
                {report.dominant_emotion}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono">
                Generated {new Date(report.generated_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={14} className="text-brand-400" />
              <span className="label">Executive Summary</span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">{report.summary}</p>
          </div>

          {/* Emotional Arc */}
          <div className="card p-5">
            <div className="label mb-3">Emotional Arc</div>
            <p className="text-sm text-slate-300 leading-relaxed">{report.emotional_arc}</p>
          </div>

          {/* Wellness indicators */}
          <div className="card p-5">
            <div className="label mb-3">Wellness Indicators</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'stress_level',         label: 'Stress Level',          colorMap: stressColor },
                { key: 'emotional_regulation',  label: 'Emotional Regulation',  colorMap: regColor },
                { key: 'authenticity',          label: 'Authenticity',          colorMap: authColor },
              ].map(({ key, label, colorMap }) => {
                const val   = wellness[key] ?? '—'
                const color = colorMap[val] ?? 'slate'
                return (
                  <div key={key} className="bg-surface rounded-lg p-3">
                    <div className="label mb-2">{label}</div>
                    <div className={`text-sm font-medium capitalize text-${color}-400`}>{val}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Key moments + recommendations side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-5">
              <div className="label mb-3">Key Moments</div>
              <ul className="space-y-2">
                {report.key_moments?.map((m, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle size={13} className="text-brand-400 mt-0.5 flex-shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <div className="label mb-3">Recommendations</div>
              <ul className="space-y-2">
                {report.recommendations?.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="text-brand-400 font-mono text-xs mt-0.5">{i + 1}.</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="card p-12 text-center space-y-3">
            <FileText size={40} className="text-slate-600 mx-auto" />
            <div className="text-slate-400 text-sm">
              Complete at least one modality analysis and run Fusion, then generate your report.
            </div>
          </div>
        )
      )}

      {loading && (
        <div className="card p-12 text-center space-y-3">
          <Loader2 size={32} className="text-brand-400 mx-auto animate-spin" />
          <div className="text-slate-400 text-sm">Generating AI behavioral report…</div>
        </div>
      )}
    </div>
  )
}
