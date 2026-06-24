import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import DashboardPage from './pages/DashboardPage'
import FacialPage    from './pages/FacialPage'
import SpeechPage    from './pages/SpeechPage'
import TextPage      from './pages/TextPage'
import MicroPage     from './pages/MicroPage'
import FusionPage    from './pages/FusionPage'
import ReportPage    from './pages/ReportPage'
import SessionsPage  from './pages/SessionsPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"          element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/facial"    element={<FacialPage />} />
        <Route path="/speech"    element={<SpeechPage />} />
        <Route path="/text"      element={<TextPage />} />
        <Route path="/micro"     element={<MicroPage />} />
        <Route path="/fusion"    element={<FusionPage />} />
        <Route path="/report"    element={<ReportPage />} />
        <Route path="/sessions"  element={<SessionsPage />} />
      </Routes>
    </Layout>
  )
}
