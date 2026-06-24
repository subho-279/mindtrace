import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import useStore from '../store/useStore'
import { analyzeText } from '../lib/api'
import EmotionBar from '../components/shared/EmotionBar'
import DominantEmotionCard from '../components/shared/DominantEmotionCard'
import { fmtMs } from '../lib/emotions'

const EXAMPLES = [
  "I'm so excited about this project, everything is coming together beautifully!",
  "I can't believe they cancelled the event. I'm really disappointed and frustrated.",
  "The meeting went okay I guess. Nothing special happened today.",
  "I'm terrified about the presentation tomorrow. What if something goes wrong?",
]

export default function TextPage() {
  const { sessionId, setTextResult, textResult } = useStore()
  const [text, setText]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleAnalyze = async () => {
    if (!text.trim() || !sessionId) return
    setLoading(true)
    try {
      const { data } = await analyzeText(text, sessionId)
      setTextResult(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Text Sentiment & Emotion</h1>
        <p className="text-sm text-slate-400 mt-1">RoBERTa fine-tuned on GoEmotions (28 → 7 labels)</p>
      </div>

      {!sessionId && (
        <div className="card p-4 text-sm text-amber-400 border-amber-400/30">
          Please create a session first.
        </div>
      )}

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 space-y-3">
          <div className="card p-4 space-y-3">
            <div className="label">Input text</div>
            <textarea
              className="input min-h-36 resize-y font-sans"
              placeholder="Type or paste text here — journal entry, transcript, chat message…"
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{text.length} chars</span>
              <button
                onClick={handleAnalyze}
                disabled={!text.trim() || !sessionId || loading}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {loading ? 'Analyzing…' : 'Analyze'}
              </button>
            </div>
          </div>

          {/* Example prompts */}
          <div className="card p-4">
            <div className="label mb-2">Try an example</div>
            <div className="space-y-2">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setText(ex)}
                  className="w-full text-left text-xs text-slate-400 hover:text-slate-200 bg-surface
                             hover:bg-surface-hover px-3 py-2 rounded-lg transition-colors border border-surface-border"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-2 space-y-3">
          {textResult ? (
            <>
              <DominantEmotionCard
                emotion={textResult.dominant}
                confidence={textResult.scores?.find(s => s.emotion === textResult.dominant)?.confidence}
              />
              <div className="card p-4">
                <div className="label mb-3">Emotion Scores</div>
                <EmotionBar scores={textResult.scores} dominant={textResult.dominant} />
              </div>
              <div className="card p-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="label mb-1">Sentiment</div>
                  <div className={
                    textResult.sentiment === 'positive' ? 'text-emerald-400' :
                    textResult.sentiment === 'negative' ? 'text-red-400' : 'text-slate-300'
                  }>
                    {textResult.sentiment}
                  </div>
                </div>
                <div>
                  <div className="label mb-1">Valence</div>
                  <div className={textResult.valence >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {textResult.valence >= 0 ? '+' : ''}{textResult.valence?.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="label mb-1">Processing</div>
                  <div className="text-slate-300">{fmtMs(textResult.processing_ms)}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="card p-6 text-center text-slate-500 text-sm">
              Enter text and click Analyze
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
