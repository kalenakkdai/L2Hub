import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '../ui/cn'

export type SettingsSection = {
  id: string
  label: string
}

type SettingsLayoutProps = {
  title: string
  description?: string
  sections: SettingsSection[]
  children: ReactNode
  /** Extra links rendered under the section list, e.g. the other settings page. */
  footerLinks?: { to: string; label: string }[]
}

/**
 * Two-column settings shell: section links on the left, content on the right,
 * collapsing to a single column with a horizontal section bar under 768px.
 *
 * Deliberately plain. Settings is a place people come to change something and
 * leave; nothing here animates beyond the verification check.
 */
export function SettingsLayout({
  title,
  description,
  sections,
  children,
  footerLinks,
}: SettingsLayoutProps) {
  const [active, setActive] = useState(sections[0]?.id ?? '')

  // Highlights the section currently in view. Read-only — clicking a link
  // still relies on native anchor scrolling rather than intercepting it.
  useEffect(() => {
    const targets = sections
      .map((section) => document.getElementById(section.id))
      .filter((node): node is HTMLElement => node !== null)

    if (targets.length === 0 || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 },
    )

    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [sections])

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-10">
      <div className="md:w-52 md:shrink-0">
        <div className="md:sticky md:top-24">
          <h1 className="text-title font-semibold text-ink">{title}</h1>
          {description && <p className="mt-1 text-[13px] text-ink-subtle">{description}</p>}

          <nav aria-label={`${title} sections`} className="mt-4">
            {/* Horizontal and scrollable on phones, vertical from md. */}
            <ul className="-mx-1 flex gap-1 overflow-x-auto pb-1 md:mx-0 md:flex-col md:overflow-visible md:pb-0">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    aria-current={active === section.id ? 'true' : undefined}
                    className={cn(
                      'block rounded-control px-3 py-1.5 text-sm whitespace-nowrap transition duration-200',
                      active === section.id
                        ? 'bg-accent-50 font-medium text-accent-600'
                        : 'text-ink-subtle hover:bg-surface-muted hover:text-ink',
                    )}
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {footerLinks && footerLinks.length > 0 && (
            <ul className="mt-4 hidden flex-col gap-1 border-t border-border-divider pt-4 md:flex">
              {footerLinks.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    className="block rounded-control px-3 py-1.5 text-sm text-ink-subtle transition duration-200 hover:bg-surface-muted hover:text-ink"
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
    </div>
  )
}
