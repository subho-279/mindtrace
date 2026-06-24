import { NavLink } from 'react-router-dom'
import { Brain, LayoutDashboard, Scan, Mic, Type, Eye,
         GitMerge, FileText, History, Zap } from 'lucide-react'
import useStore from '../../store/useStore'
import SessionBadge from '../shared/SessionBadge'
import clsx from 'clsx'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/facial',    icon: Scan,            label: 'Facial Emotion' },
  { to: '/speech',    icon: Mic,             label: 'Speech Emotion' },
  { to: '/text',      icon: Type,            label: 'Text Sentiment' },
  { to: '/micro',     icon: Eye,             label: 'Micro-Expression' },
  null, // divider
  { to: '/fusion',    icon: GitMerge,        label: 'Multimodal Fusion' },
  { to: '/report',    icon: FileText,        label: 'Behavioral Report' },
  { to: '/sessions',  icon: History,         label: 'Sessions' },
]

export default function Layout({ children }) {
  const { wsConnected, sessionId } = useStore()

  return (
    <div className="flex h-full bg-surface">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-surface-border">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-surface-border">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0">
            <Brain size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white leading-none">MindTrace</div>
            <div className="text-xs text-brand-400 font-mono mt-0.5">++ v1.0</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
          {NAV.map((item, i) =>
            item === null ? (
              <div key={i} className="my-2 border-t border-surface-border" />
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-100',
                  isActive
                    ? 'bg-brand-500/20 text-brand-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover'
                )}
              >
                <item.icon size={15} />
                {item.label}
              </NavLink>
            )
          )}
        </nav>

        {/* Status footer */}
        <div className="px-4 py-3 border-t border-surface-border space-y-2">
          <div className="flex items-center gap-2">
            <div className={clsx('w-2 h-2 rounded-full', wsConnected ? 'bg-emerald-400 pulse-live' : 'bg-slate-600')} />
            <span className="text-xs text-slate-500">{wsConnected ? 'WS connected' : 'WS offline'}</span>
          </div>
          {sessionId && (
            <div className="text-xs text-slate-500 font-mono truncate">
              {sessionId.slice(0, 16)}…
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <SessionBadge />
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
