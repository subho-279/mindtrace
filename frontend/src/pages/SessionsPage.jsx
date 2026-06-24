import { useEffect, useState } from 'react'
import { Trash2, Play, RefreshCw } from 'lucide-react'
import useStore from '../store/useStore'
import { listSessions, deleteSession } from '../lib/api'

export default function SessionsPage() {
  const { setSession, resetAll } = useStore()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await listSessions()
      setSessions(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleResume = (s) => {
    resetAll()
    setSession(s.session_id, s.label)
  }

  const handleDelete = async (id) => {
    await deleteSession(id)
    setSessions(ss => ss.filter(s => s.session_id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Sessions</h1>
          <p className="text-sm text-slate-400 mt-1">Recent analysis sessions (last 50)</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 text-sm">
          {loading ? 'Loading…' : 'No sessions yet. Create one using "New Session".'}
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <div key={s.session_id} className="card p-4 flex items-center gap-4 hover:border-brand-500/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-200 truncate">{s.label}</div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-mono text-slate-500">{s.session_id.slice(0, 16)}…</span>
                  <span className="text-xs text-slate-500">
                    {new Date(s.created_at).toLocaleString()}
                  </span>
                  <div className="flex gap-1">
                    {s.modalities?.map(m => (
                      <span key={m} className="text-xs px-1.5 py-0.5 rounded bg-surface border border-surface-border text-slate-400 capitalize">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleResume(s)}
                  className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
                >
                  <Play size={12} /> Resume
                </button>
                <button
                  onClick={() => handleDelete(s.session_id)}
                  className="text-slate-500 hover:text-red-400 transition-colors p-1.5"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
