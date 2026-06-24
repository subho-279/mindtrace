import { Plus, X } from 'lucide-react'
import useStore from '../../store/useStore'
import { createSession } from '../../lib/api'

export default function SessionBadge() {
  const { sessionId, sessionLabel, setSession, clearSession, resetAll } = useStore()

  const handleNew = async () => {
    const label = `Session ${new Date().toLocaleTimeString()}`
    const { data } = await createSession(label)
    setSession(data.session_id, data.label)
    resetAll()
  }

  const handleClear = () => {
    clearSession()
    resetAll()
  }

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-surface-border bg-surface-card">
      {sessionId ? (
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-brand-400 pulse-live" />
          <div>
            <span className="text-sm font-medium text-slate-200">{sessionLabel}</span>
            <span className="ml-2 text-xs font-mono text-slate-500">{sessionId.slice(0, 12)}…</span>
          </div>
          <button onClick={handleClear} className="ml-2 text-slate-500 hover:text-slate-300 transition-colors">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <span>No active session</span>
        </div>
      )}
      <button onClick={handleNew} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
        <Plus size={13} />
        New Session
      </button>
    </div>
  )
}
