import { BookOpenCheck, House, PanelLeftClose } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-sm px-2.5 py-2 text-[13px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${
    isActive
      ? 'bg-sky-100 text-sky-950'
      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
  }`

/**
 * Minimal Grades chrome. Does not own global auth or design tokens.
 * Replace with the host app shell when one exists.
 */
export function GradesLayout() {
  return (
    <div className="min-h-screen bg-white text-slate-900 md:flex">
      <aside
        className="shrink-0 border-b border-slate-200 bg-slate-50 md:flex md:min-h-screen md:w-40 md:flex-col md:border-b-0 md:border-r"
        aria-label="L2 Hub navigation"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-2.5 py-3">
          <div>
            <p className="text-[15px] font-bold tracking-tight text-sky-800">
              L2 Hub
            </p>
            <p className="text-[8px] font-medium uppercase tracking-wider text-slate-400">
              Student government
            </p>
          </div>
          <PanelLeftClose
            size={15}
            className="hidden text-slate-400 md:block"
            aria-hidden="true"
          />
        </div>

        <div className="hidden px-2.5 py-4 md:block">
          <p className="text-[15px] font-bold text-slate-900">Leadership 2</p>
          <p className="mt-1 text-[10px] leading-4 text-slate-600">
            Mission San Jose HS
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">2026–27</p>
        </div>

        <nav className="flex gap-1 px-2 py-2 md:flex-col md:py-0">
          <NavLink to="/dashboard" className={navLinkClass}>
            <House size={14} aria-hidden="true" />
            Dashboard
          </NavLink>
          <NavLink to="/grades" className={navLinkClass}>
            <BookOpenCheck size={14} aria-hidden="true" />
            Grades
          </NavLink>
        </nav>

        <div className="mt-5 hidden border-t border-slate-200 px-2.5 py-3 md:block">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Your context
          </p>
          <p className="mt-2 text-[11px] font-medium text-slate-700">
            Events Committee
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">Student view</p>
        </div>

        <div className="mt-auto hidden border-t border-slate-200 px-2.5 py-3 md:block">
          <p className="text-[10px] font-semibold text-slate-700">Kalena Dai</p>
          <p className="mt-0.5 text-[9px] text-slate-400">Account</p>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
