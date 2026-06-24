import { create } from 'zustand'

const useStore = create((set, get) => ({
  // ── Session ──────────────────────────────────────────────────────────────
  sessionId: null,
  sessionLabel: '',
  sessions: [],

  setSession: (id, label = '') => set({ sessionId: id, sessionLabel: label }),
  clearSession: () => set({ sessionId: null, sessionLabel: '' }),
  setSessions: (sessions) => set({ sessions }),

  // ── Modality results ──────────────────────────────────────────────────────
  facialResult: null,
  speechResult: null,
  textResult: null,
  microEvents: [],
  fusedResult: null,
  report: null,

  setFacialResult: (r) => set({ facialResult: r }),
  setSpeechResult: (r) => set({ speechResult: r }),
  setTextResult:   (r) => set({ textResult: r }),
  setMicroEvents:  (e) => set({ microEvents: e }),
  setFusedResult:  (r) => set({ fusedResult: r }),
  setReport:       (r) => set({ report: r }),

  // ── Live timeline (facial frames streamed from webcam) ────────────────────
  emotionTimeline: [],  // [{t, emotion, confidence}, ...]
  pushTimelineEntry: (entry) =>
    set(s => ({
      emotionTimeline: [...s.emotionTimeline.slice(-199), entry],
    })),
  clearTimeline: () => set({ emotionTimeline: [] }),

  // ── WebSocket status ──────────────────────────────────────────────────────
  wsConnected: false,
  setWsConnected: (v) => set({ wsConnected: v }),

  // ── UI ────────────────────────────────────────────────────────────────────
  isLiveMode: false,
  setLiveMode: (v) => set({ isLiveMode: v }),

  resetAll: () => set({
    facialResult: null, speechResult: null, textResult: null,
    microEvents: [], fusedResult: null, report: null,
    emotionTimeline: [], isLiveMode: false,
  }),
}))

export default useStore
