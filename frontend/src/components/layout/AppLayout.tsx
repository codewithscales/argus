import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'

const NAV = [
  { to: '/runs',   label: 'Runs',   icon: '▶' },
  { to: '/agents', label: 'Agents', icon: '⬡' },
]

export default function AppLayout() {
  return (
    <div className="flex h-full">
      <aside className="w-48 shrink-0 flex flex-col bg-slate-900 border-r border-slate-800">
        <div className="px-4 py-5 border-b border-slate-800">
          <span className="text-slate-100 font-semibold tracking-wide">Argus</span>
          <span className="ml-2 text-xs text-slate-500">agent bench</span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                )
              }
            >
              <span className="text-xs">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-slate-800">
          <span className="text-xs text-slate-600">v0.1.0</span>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
