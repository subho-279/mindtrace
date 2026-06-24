export const EMOTIONS = ['happy','sad','angry','fear','disgust','surprise','neutral','contempt']

export const EMOTION_COLOR = {
  happy:    '#fbbf24',
  angry:    '#f87171',
  sad:      '#60a5fa',
  fear:     '#a78bfa',
  disgust:  '#34d399',
  surprise: '#fb923c',
  neutral:  '#94a3b8',
  contempt: '#f472b6',
}

export const EMOTION_EMOJI = {
  happy:    '😊', angry: '😡', sad: '😢', fear: '😨',
  disgust:  '🤢', surprise: '😲', neutral: '😐', contempt: '😒',
}

export const EMOTION_BG = {
  happy:    'rgba(251,191,36,0.15)',
  angry:    'rgba(248,113,113,0.15)',
  sad:      'rgba(96,165,250,0.15)',
  fear:     'rgba(167,139,250,0.15)',
  disgust:  'rgba(52,211,153,0.15)',
  surprise: 'rgba(251,146,60,0.15)',
  neutral:  'rgba(148,163,184,0.15)',
  contempt: 'rgba(244,114,182,0.15)',
}

export const pct = (v) => `${Math.round((v || 0) * 100)}%`
export const fmtMs = (ms) => ms < 1000 ? `${Math.round(ms)}ms` : `${(ms/1000).toFixed(1)}s`
