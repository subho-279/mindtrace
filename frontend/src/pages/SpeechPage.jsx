import { useState, useRef } from 'react'
import { Mic, MicOff, Upload, Loader2, StopCircle } from 'lucide-react'
import useStore from '../store/useStore'
import { analyzeSpeech } from '../lib/api'
import EmotionBar from '../components/shared/EmotionBar'
import DominantEmotionCard from '../components/shared/DominantEmotionCard'
import UploadZone from '../components/shared/UploadZone'
import { fmtMs } from '../lib/emotions'

export default function SpeechPage() {
  const { sessionId, setSpeechResult, speechResult } = useStore()
  const [tab, setTab]           = useState('record')
  const [recording, setRecording] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [recSeconds, setRecSeconds] = useState(0)
  const mediaRecRef = useRef(null)
  const chunksRef   = useRef([])
  const timerRef    = useRef(null)

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    chunksRef.current = []
    const mr = new MediaRecorder(stream)
    mr.ondataavailable = e => chunksRef.current.push(e.data)
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const file = new File([blob], 'recording.webm', { type: 'audio/webm' })
      setLoading(true)
      try {
        const { data } = await analyzeSpeech(file, sessionId)
        setSpeechResult(data)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    mr.start()
    mediaRecRef.current = mr
    setRecording(true)
    setRecSeconds(0)
    timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
  }

  const stopRecording = () => {
    mediaRecRef.current?.stop()
    clearInterval(timerRef.current)
    setRecording(false)
  }

  const handleUpload = async () => {
    if (!uploadFile || !sessionId) return
    setLoading(true)
    try {
      const { data } = await analyzeSpeech(uploadFile, sessionId)
      setSpeechResult(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Speech Emotion Recognition</h1>
        <p className="text-sm text-slate-400 mt-1">Wav2Vec2 · Librosa MFCC — mic or audio file</p>
      </div>

      {!sessionId && (
        <div className="card p-4 text-sm text-amber-400 border-amber-400/30">
          Please create a session first.
        </div>
      )}

      <div className="flex gap-1 bg-surface-card rounded-lg p-1 w-fit border border-surface-border">
        {['record', 'upload'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {t === 'record' ? '🎙 Record' : '🎵 Upload Audio'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3">
          {tab === 'record' ? (
            <div className="card p-6 flex flex-col items-center gap-5">
              {/* Waveform visual */}
              <div className="flex items-end gap-1 h-12">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 rounded-full ${recording ? 'wave-bar' : ''}`}
                    style={{
                      height: recording ? '100%' : '30%',
                      background: recording ? '#4f6ef7' : '#2a3448',
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>

              {recording && (
                <div className="text-brand-400 font-mono text-sm">
                  {String(Math.floor(recSeconds / 60)).padStart(2, '0')}:
                  {String(recSeconds % 60).padStart(2, '0')}
                </div>
              )}

              {!recording ? (
                <button
                  onClick={startRecording}
                  disabled={!sessionId || loading}
                  className="btn-primary flex items-center gap-2"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
                  {loading ? 'Analyzing…' : 'Start Recording'}
                </button>
              ) : (
                <button onClick={stopRecording} className="btn-secondary flex items-center gap-2">
                  <StopCircle size={14} className="text-red-400" />
                  Stop & Analyze
                </button>
              )}

              <p className="text-xs text-slate-500 text-center">
                Record at least 2 seconds for best results.<br />
                Audio is processed locally — never stored.
              </p>
            </div>
          ) : (
            <div className="card p-4 space-y-3">
              <UploadZone
                accept="audio/*"
                onFile={setUploadFile}
                label="Drop an audio file here"
                hint="WAV, MP3, OGG, WEBM supported"
              />
              <button
                onClick={handleUpload}
                disabled={!uploadFile || !sessionId || loading}
                className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {loading ? 'Analyzing…' : 'Analyze Audio'}
              </button>
            </div>
          )}
        </div>

        <div className="col-span-2 space-y-3">
          {speechResult ? (
            <>
              <DominantEmotionCard
                emotion={speechResult.dominant}
                confidence={speechResult.scores?.find(s => s.emotion === speechResult.dominant)?.confidence}
              />
              <div className="card p-4">
                <div className="label mb-3">Emotion Scores</div>
                <EmotionBar scores={speechResult.scores} dominant={speechResult.dominant} />
              </div>
              <div className="card p-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="label mb-1">Valence</div>
                  <div className={speechResult.valence >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {speechResult.valence >= 0 ? '+' : ''}{speechResult.valence?.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="label mb-1">Arousal</div>
                  <div className="text-slate-300">{speechResult.arousal?.toFixed(2)}</div>
                </div>
                <div>
                  <div className="label mb-1">Duration</div>
                  <div className="text-slate-300">{speechResult.duration_s?.toFixed(1)}s</div>
                </div>
                <div>
                  <div className="label mb-1">Processing</div>
                  <div className="text-slate-300">{fmtMs(speechResult.processing_ms)}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="card p-6 text-center text-slate-500 text-sm">
              {tab === 'record' ? 'Record audio to see results' : 'Upload audio to analyze'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
