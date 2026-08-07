import { useEffect, useMemo, useRef, useState } from 'react'

type GraphNode = {
  id: string
  label: string
  mentions: number
  kind: string
}

type GraphEdge = {
  source: string
  target: string
}

type ThemeDetail = {
  id: string
  label: string
  mentions: number
  kind: string
  summary: string
  recommendedAction?: string | null
  positivePatterns?: string | null
  improvementPatterns?: string | null
  contributors: Array<{
    name: string | null
    committee: string | null
    quote: string
    anonymous: boolean
  }>
}

type SimNode = GraphNode & {
  x: number
  y: number
  vx: number
  vy: number
}

type FeedbackConstellationProps = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  themes: ThemeDetail[]
  reducedMotion?: boolean
}

export function FeedbackConstellation({
  nodes,
  edges,
  themes,
  reducedMotion = false,
}: FeedbackConstellationProps) {
  const width = 720
  const height = 480
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(nodes[0]?.id ?? null)
  const [positions, setPositions] = useState<SimNode[]>(() =>
    nodes.slice(0, 30).map((node, index) => {
      const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2
      const radius = 120 + (index % 4) * 28
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      }
    }),
  )
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(
    null,
  )

  useEffect(() => {
    if (reducedMotion) return
    let frame = 0
    const tick = () => {
      setPositions((prev) => {
        const next = prev.map((n) => ({ ...n }))
        const byId = new Map(next.map((n) => [n.id, n]))

        for (const a of next) {
          for (const b of next) {
            if (a.id === b.id) continue
            const dx = a.x - b.x
            const dy = a.y - b.y
            const dist = Math.max(Math.hypot(dx, dy), 1)
            const force = 900 / (dist * dist)
            a.vx += (dx / dist) * force * 0.02
            a.vy += (dy / dist) * force * 0.02
          }
          const cx = width / 2 - a.x
          const cy = height / 2 - a.y
          a.vx += cx * 0.002
          a.vy += cy * 0.002
        }

        for (const edge of edges) {
          const a = byId.get(edge.source)
          const b = byId.get(edge.target)
          if (!a || !b) continue
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.max(Math.hypot(dx, dy), 1)
          const pull = (dist - 110) * 0.01
          a.vx += dx * pull * 0.02
          a.vy += dy * pull * 0.02
          b.vx -= dx * pull * 0.02
          b.vy -= dy * pull * 0.02
        }

        for (const n of next) {
          if (dragRef.current?.id === n.id) continue
          n.vx *= 0.85
          n.vy *= 0.85
          n.x = Math.min(width - 40, Math.max(40, n.x + n.vx))
          n.y = Math.min(height - 40, Math.max(40, n.y + n.vy))
        }
        return next
      })
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [edges, reducedMotion])

  const themeById = useMemo(
    () => new Map(themes.map((theme) => [theme.id, theme])),
    [themes],
  )
  const selected = selectedId ? themeById.get(selectedId) : undefined
  const posById = useMemo(
    () => new Map(positions.map((n) => [n.id, n])),
    [positions],
  )

  const onPointerDown = (id: string, event: React.PointerEvent) => {
    const node = posById.get(id)
    if (!node || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    dragRef.current = {
      id,
      offsetX: event.clientX * scaleX - (rect.left * scaleX + node.x),
      offsetY: event.clientY * scaleY - (rect.top * scaleY + node.y),
    }
    setSelectedId(id)
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    const x = (event.clientX - rect.left) * scaleX - drag.offsetX
    const y = (event.clientY - rect.top) * scaleY - drag.offsetY
    setPositions((prev) =>
      prev.map((n) =>
        n.id === drag.id
          ? { ...n, x: Math.min(width - 40, Math.max(40, x)), y: Math.min(height - 40, Math.max(40, y)), vx: 0, vy: 0 }
          : n,
      ),
    )
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full rounded-card border border-white/15 bg-[#0b1f14]"
        role="img"
        aria-label="Feedback constellation graph"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {edges.map((edge) => {
          const a = posById.get(edge.source)
          const b = posById.get(edge.target)
          if (!a || !b) return null
          return (
            <line
              key={`${edge.source}-${edge.target}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={1.5}
            />
          )
        })}
        {positions.map((node) => {
          const radius = 14 + Math.min(node.mentions, 30) * 0.45
          const fill =
            node.kind === 'improvement'
              ? '#86efac'
              : node.kind === 'mixed'
                ? '#bbf7d0'
                : '#f0fdf4'
          const selected = node.id === selectedId
          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              style={{ cursor: 'grab' }}
              onPointerDown={(event) => onPointerDown(node.id, event)}
            >
              <circle
                r={radius}
                fill={fill}
                stroke={selected ? '#ffffff' : 'rgba(255,255,255,0.35)'}
                strokeWidth={selected ? 3 : 1}
              />
              <text
                textAnchor="middle"
                y={radius + 14}
                fill="#ecfdf5"
                fontSize={11}
                fontWeight={600}
              >
                {node.label}
              </text>
            </g>
          )
        })}
      </svg>

      <aside className="rounded-card border border-white/15 bg-white/5 p-4 text-emerald-50">
        {selected ? (
          <>
            <p className="text-xs font-semibold tracking-wide text-emerald-200/80 uppercase">
              Theme detail
            </p>
            <h3 className="mt-1 text-lg font-semibold">{selected.label}</h3>
            <p className="mt-1 text-xs text-emerald-100/70">
              {selected.mentions} mentions · {selected.kind}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-emerald-50/90">
              {selected.summary}
            </p>
            {selected.recommendedAction ? (
              <p className="mt-3 text-sm text-emerald-100">
                <span className="font-semibold">Action:</span>{' '}
                {selected.recommendedAction}
              </p>
            ) : null}
            <ul className="mt-4 space-y-3">
              {selected.contributors.map((c, index) => (
                <li
                  key={`${selected.id}-${index}`}
                  className="rounded-control border border-white/10 bg-black/20 px-3 py-2"
                >
                  <p className="text-sm italic text-emerald-50/90">“{c.quote}”</p>
                  <p className="mt-1 text-xs text-emerald-200/70">
                    {c.anonymous
                      ? 'Anonymous contributor'
                      : [c.name, c.committee].filter(Boolean).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-emerald-100/70">Select a theme node.</p>
        )}
      </aside>
    </div>
  )
}
