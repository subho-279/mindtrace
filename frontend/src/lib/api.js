import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 60_000,
})

export default api

// ── Facial ────────────────────────────────────────────────────────────────
export const analyzeFacial = (file, sessionId) => {
  const form = new FormData()
  form.append('file', file)
  form.append('session_id', sessionId)
  return api.post('/facial/analyze', form)
}

export const streamFrame = (blob, sessionId, frameId) => {
  const form = new FormData()
  form.append('file', blob, 'frame.jpg')
  form.append('session_id', sessionId)
  form.append('frame_id', frameId)
  return api.post('/facial/stream-frame', form)
}

// ── Speech ────────────────────────────────────────────────────────────────
export const analyzeSpeech = (file, sessionId) => {
  const form = new FormData()
  form.append('file', file)
  form.append('session_id', sessionId)
  return api.post('/speech/analyze', form)
}

// ── Text ──────────────────────────────────────────────────────────────────
export const analyzeText = (text, sessionId) =>
  api.post('/text/analyze', { text, session_id: sessionId })

// ── Micro ─────────────────────────────────────────────────────────────────
export const analyzeMicro = (file, sessionId, fps = 30) => {
  const form = new FormData()
  form.append('file', file)
  form.append('session_id', sessionId)
  form.append('fps', fps)
  return api.post('/micro/analyze', form)
}

// ── Fusion ────────────────────────────────────────────────────────────────
export const fuseSession = (sessionId, strategy = 'late') =>
  api.post('/fusion/analyze', { session_id: sessionId, strategy })

export const generateReport = (sessionId) =>
  api.post(`/fusion/report/${sessionId}`)

export const getReport = (sessionId) =>
  api.get(`/fusion/report/${sessionId}`)

// ── Session ───────────────────────────────────────────────────────────────
export const createSession = (label = '', modalities = ['facial','speech','text','micro']) =>
  api.post('/session/create', { label, modalities })

export const listSessions = () =>
  api.get('/session/')

export const deleteSession = (sessionId) =>
  api.delete(`/session/${sessionId}`)
