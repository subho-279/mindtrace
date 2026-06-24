import { useRef, useState, useEffect, useCallback } from 'react'
import { Camera, CameraOff, Upload, Loader2 } from 'lucide-react'
import useStore from '../store/useStore'
import { useWebcam } from '../hooks/useWebcam'
import { analyzeFacial, streamFrame } from '../lib/api'
import EmotionBar from '../components/shared/EmotionBar'
import DominantEmotionCard from '../components/shared/DominantEmotionCard'
import UploadZone from '../components/shared/UploadZone'
import { fmtMs } from '../lib/emotions'

const CAPTURE_INTERVAL_MS = 1000   // send a frame every 1s during live mode

export default function FacialPage() {
  const { sessionId, setFacialResult, facialResult, pushTimelineEntry } = useStore()
  const { videoRef, active, error, start, stop, captureFrame } = useWebcam()
  const [loading, setLoading]   = useState(false)
  const [tab, setTab]           = useState('live')   // 'live' | 'upload'
  const [uploadFile, setUploadFile] = useState(null)
  const intervalRef = useRef(null)
  const frameIdRef  = useRef(0)

  const sendFrame = useCallback(async () => {
    if (!sessionId) return
    const blob = await captureFrame()
    if (!blob) return
    try {
      const { data } = await streamFrame(blob, sessionId, frameIdRef.current++)
      setFacialResult(data)
      if (data.dominant) {
        pushTimelineEntry({
          t: Date.now(),
          emotion: data.dominant,
          confidence: data.scores?.find(s => s.emotion === data.dominant)?.confidence ?? 0,
        })
      }
    } catch (_) {}
  }, [sessionId, captureFrame])

  const startLive = async () => {
    await start()
    intervalRef.current = setInterval(sendFrame, CAPTURE_INTERVAL_MS)
  }

  const stopLive = () => {
    stop()
    clearInterval(intervalRef.current)
  }

  useEffect(() => () => { clearInterval(intervalRef.current); stop() }, [])

  const handleUpload = async () => {
    if (!uploadFile || !sessionId) return
    setLoading(true)
    try {
      const { data } = await analyzeFacial(uploadFile, sessionId)
      setFacialResult(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Facial Emotion Recognition</h1>
        <p className="text-sm text-slate-400 mt-1">DeepFace + MediaPipe — real-time or image upload</p>
      </div>

      {!sessionId && (
        <div className="card p-4 text-sm text-amber-400 border-amber-400/30">
          Please create a session first using the "New Session" button above.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-card rounded-lg p-1 w-fit border border-surface-border">
        {['live', 'upload'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t === 'live' ? '📷 Live Webcam' : '🖼 Upload Image'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Camera / upload area */}
        <div className="col-span-3 space-y-3">
          {tab === 'live' ? (
            <div className="card overflow-hidden">
              <div className="relative bg-black aspect-video flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!active && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Camera size={48} className="text-slate-600" />
                  </div>
                )}
                {active && facialResult?.face_detected === false && (
                  <div className="absolute top-3 left-3 bg-red-500/80 text-white text-xs px-2 py-1 rounded">
                    No face detected
                  </div>
                )}
                {active && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded text-xs text-white">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 pulse-live" />
                    LIVE
                  </div>
                )}
              </div>
              <div className="p-3 flex gap-2">
                {!active ? (
                  <button
                    onClick={startLive}
                    disabled={!sessionId}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    <Camera size={14} /> Start Camera
                  </button>
                ) : (
                  <button onClick={stopLive} className="btn-secondary flex items-center gap-2 text-sm">
                    <CameraOff size={14} /> Stop
                  </button>
                )}
                {error && <span className="text-xs text-red-400 self-center">{error}</span>}
              </div>
            </div>
          ) : (
            <div className="card p-4 space-y-3">
              <UploadZone
                accept="image/*"
                onFile={setUploadFile}
                label="Drop an image here"
                hint="JPG, PNG, WEBP supported"
              />
              <button
                onClick={handleUpload}
                disabled={!uploadFile || !sessionId || loading}
                className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Analyze Image
              </button>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="col-span-2 space-y-3">
          {facialResult ? (
            <>
              <DominantEmotionCard
                emotion={facialResult.dominant}
                confidence={facialResult.scores?.find(s => s.emotion === facialResult.dominant)?.confidence}
              />
              <div className="card p-4">
                <div className="label mb-3">Emotion Scores</div>
                <EmotionBar scores={facialResult.scores} dominant={facialResult.dominant} />
              </div>
              <div className="card p-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="label mb-1">Face Detected</div>
                  <div className={facialResult.face_detected ? 'text-emerald-400' : 'text-red-400'}>
                    {facialResult.face_detected ? 'Yes' : 'No'}
                  </div>
                </div>
                <div>
                  <div className="label mb-1">Landmarks</div>
                  <div className="text-slate-300">{facialResult.landmarks_count ?? '—'}</div>
                </div>
                <div>
                  <div className="label mb-1">Processing</div>
                  <div className="text-slate-300">{fmtMs(facialResult.processing_ms)}</div>
                </div>
                <div>
                  <div className="label mb-1">Frame ID</div>
                  <div className="text-slate-300 font-mono">{facialResult.frame_id ?? '—'}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="card p-6 text-center text-slate-500 text-sm">
              {tab === 'live' ? 'Start camera to see results' : 'Upload an image to analyze'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
