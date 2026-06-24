import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { EMOTION_COLOR, EMOTIONS } from '../../lib/emotions'

export default function EmotionTimeline({ timeline = [] }) {
  if (timeline.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
        Timeline populates during live analysis…
      </div>
    )
  }

  // Build per-emotion series
  const seriesData = timeline.map((entry, i) => {
    const point = { t: i }
    EMOTIONS.forEach(e => { point[e] = 0 })
    if (entry.emotion) point[entry.emotion] = Math.round(entry.confidence * 100)
    return point
  })

  const activeEmotions = EMOTIONS.filter(e =>
    seriesData.some(d => d[e] > 0)
  )

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={seriesData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke="#1e2535" strokeDasharray="3 3" />
        <XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} domain={[0, 100]} />
        <Tooltip
          contentStyle={{ background: '#161b27', border: '1px solid #1e2535', borderRadius: 8 }}
          labelStyle={{ color: '#94a3b8', fontSize: 11 }}
          itemStyle={{ fontSize: 11 }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        {activeEmotions.map(e => (
          <Line
            key={e}
            type="monotone"
            dataKey={e}
            stroke={EMOTION_COLOR[e]}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
