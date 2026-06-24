import { useState } from 'react'
import { Loader2, Upload, AlertTriangle, Eye } from 'lucide-react'
import useStore from '../store/useStore'
import { analyzeMicro } from '../lib/api'
import UploadZone from '../components/shared/UploadZone'
import { EMOTION_COLOR, EMOTION_EMOJI } from '../lib/emotions'

export default function MicroPage() {
  const { sessionId, microEvents, setMicroEvents } = useStore()
  const [file, setFile]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [fps, setFps]         = useState(30)

  const handleAnalyze = async () => {
    if (!file || !sessionId) return
    setLoading(true)
    try {
      const { data } = await analyzeMicro(file, sessionId, fps)
      setMicroEvents(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Micro-Expression Detection</h1>
        <p className="text-sm text-slate-400 mt-1">
          OpenCV optical flow + FACS AU analysis — detects suppressed emotions (40–500ms)
        </p>
      </div>

      {!sessionId && (
        <div className="card p-4 text-sm text-amber-400 border-amber-400/30">
          Please create a session first.
        </div>
      )}

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 space-y-3">
          <div className="card p-4 space-y-3">
            <UploadZone
              accept="video/*"
              onFile={setFile}
              label="Upload a video file"
              hint="MP4, MOV, AVI — ideally 25+ FPS for micro-expression detection"
            />

            <div className="flex items-center gap-3">
              <label className="label whitespace-nowrap">Video FPS</label>
              <input
                type="number"
                value={fps}
                onChange={e => setFps(Number(e.target.value))}
                className="input w-24 text-sm"
                min={15}
                max={120}
              />
              <span className="text-xs text-slate-500">
                Auto-detected from video if available
              </span>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!file || !sessionId || loading}
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {loading ? 'Analyzing video…' : 'Detect Micro-Expressions'}
            </button>
          </div>

          <div className="card p-4 text-xs text-slate-400 space-y-2">
            <div className="label">How it works</div>
            <div className="space-y-1 leading-relaxed">
              <p>1. Dense optical flow (Farnebäck) computed between consecutive frames.</p>
              <p>2. Motion spikes (2σ above baseline) flagged as candidate events.</p>
              <p>3. Events lasting 40–500ms classified via Action Unit (AU) mapping.</p>
              <p>4. AUs mapped to suppressed emotions using FACS taxonomy.</p>
            </div>
          </div>
        </div>

        <div className="col-span-2 space-y-3">
          {microEvents?.length > 0 ? (
            <>
              <div className="card p-4 flex items-center gap-3">
                <AlertTriangle size={20} className="text-orange-400" />
                <div>
                  <div className="text-lg font-semibold text-orange-400">{microEvents.length}</div>
                  <div className="text-xs text-slate-400">micro-expressions detected</div>
                </div>
              </div>

              <div className="card p-4 space-y-3">
                <div className="label">Event Log</div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {microEvents.map((evt, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-2.5 rounded-lg bg-surface text-xs border border-surface-border"
                    >
                      <span className="text-lg mt-0.5">{EMOTION_EMOJI[evt.suppressed_emotion] ?? '❓'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium capitalize" style={{ color: EMOTION_COLOR[evt.suppressed_emotion] }}>
                            {evt.suppressed_emotion}
                          </span>
                          <span className="text-slate-500 font-mono">{evt.timestamp_ms}ms</span>
                        </div>
                        <div className="text-slate-500">
                          Duration: {evt.duration_ms}ms · {Math.round(evt.confidence * 100)}% confidence
                        </div>
                        {evt.action_units?.length > 0 && (
                          <div className="text-slate-600 mt-0.5">
                            AUs: {evt.action_units.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="card p-6 text-center space-y-3">
              <Eye size={32} className="text-slate-600 mx-auto" />
              <div className="text-sm text-slate-500">
                {loading ? 'Processing video…' : 'Upload a video to detect micro-expressions'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
