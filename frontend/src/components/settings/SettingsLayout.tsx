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
  /** Rendered in the left column under the title, e.g. the avatar picker. */
  aside?: ReactNode
  /** Extra links rendered under the section list, e.g. the other settings page. */
  footerLinks?: { to: string; label: string }[]
}

/**
 * Two-column settings shell: identity and section links on the left, content
 * on the right, collapsing to a single column with a horizontal section bar
 * under 768px.
 *
 * Everything in the left column shares one text origin — the title, the
 * description, the section links, and anything passed as `aside` all start at
 * the same x. The title and description used to sit flush against the column
 * edge while the links were inset by their own padding, so the heading hung a
 * few pixels to the left of the list it introduced.
 *
 * Deliberately plain. Settings is a place people come to change something and
 * leave; nothing here animates beyond the verification check.
 */
export function SettingsLayout({
  title,
  description,
  sections,
  children,
  aside,
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
      <div className="md:w-60 md:shrink-0">
        {/* Two separate things keep this column level with the first card.

            `pt-[25px]` matches where a SettingsCard puts its heading: the card
            is `border` + `p-5 sm:p-6`, so its <h2> starts 25px below the card
            top at md and above (1px border + 24px padding). Without it the
            title sat a full card-padding above the content it introduces.

            The sticky offset has to stay at or below the column's natural
            distance from the top of the viewport, or sticky clamps the column
            *downwards* on an unscrolled page and the title drops below the
            card heading. AppShell's <main> is `py-7`, so that distance is
            28px at lg and above, where the navigation is a fixed left sidebar
            and nothing overlaps the content. Below lg the navigation is a
            60px `sticky top-0` bar instead, so the column has to clear it —
            68px leaves a little air and is still under the 88px it naturally
            sits at there (60px bar + 28px padding). */}
        <div className="md:sticky md:top-[68px] md:pt-[25px] lg:top-7">
          {/* px-3 matches the section links below, so the whole column shares
              one left edge. */}
          <h1 className="px-3 text-title font-semibold text-ink">{title}</h1>
          {description && (
            <p className="mt-1 px-3 text-[13px] text-ink-subtle">{description}</p>
          )}

          {aside && <div className="mt-5">{aside}</div>}

          <nav aria-label={`${title} sections`} className="mt-5">
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
                        ? 'bg-accent-50 font-medium text-accent-ink'
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
