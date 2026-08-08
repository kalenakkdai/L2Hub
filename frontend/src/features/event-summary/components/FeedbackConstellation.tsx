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

export const WIDTH = 720
export const HEIGHT = 520
const MAX_NODES = 30
const LABEL_FONT_SIZE = 11
// Labels sit under each circle, so a node's footprint is wider than the circle
// whenever its label is long. Approximating the advance width per character is
// enough to reserve space without measuring text in the DOM.
const LABEL_CHAR_WIDTH = 5.9
const LABEL_HEIGHT = 15
const NODE_GAP = 12

type Box = { halfWidth: number; halfHeight: number }

function radiusFor(mentions: number): number {
  return 14 + Math.min(mentions, 30) * 0.45
}

/** Exported so the layout test can assert on the same footprint the simulation uses. */
export function boxFor(node: GraphNode): Box {
  const radius = radiusFor(node.mentions)
  return {
    halfWidth: Math.max(radius, (node.label.length * LABEL_CHAR_WIDTH) / 2),
    halfHeight: radius + LABEL_HEIGHT,
  }
}

function clampIntoView(node: SimNode, box: Box) {
  const minX = box.halfWidth + 2
  const minY = box.halfHeight + 2
  node.x = Math.min(WIDTH - minX, Math.max(minX, node.x))
  node.y = Math.min(HEIGHT - minY, Math.max(minY, node.y))
}

/**
 * Push apart any pair whose label boxes intersect, resolving along whichever
 * axis needs the least movement. Running this after the force pass makes
 * non-overlap a hard guarantee rather than something the forces tend toward.
 */
function separate(nodes: SimNode[], boxes: Map<string, Box>, passes = 4) {
  for (let pass = 0; pass < passes; pass += 1) {
    let moved = false

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]
        const b = nodes[j]
        const boxA = boxes.get(a.id)
        const boxB = boxes.get(b.id)
        if (!boxA || !boxB) continue

        const minX = boxA.halfWidth + boxB.halfWidth + NODE_GAP
        const minY = boxA.halfHeight + boxB.halfHeight + NODE_GAP
        const dx = b.x - a.x
        const dy = b.y - a.y
        const overlapX = minX - Math.abs(dx)
        const overlapY = minY - Math.abs(dy)
        if (overlapX <= 0 || overlapY <= 0) continue

        if (overlapX < overlapY) {
          const push = (overlapX / 2) * (dx >= 0 ? 1 : -1)
          a.x -= push
          b.x += push
        } else {
          const push = (overlapY / 2) * (dy >= 0 ? 1 : -1)
          a.y -= push
          b.y += push
        }
        moved = true
      }
    }

    for (const node of nodes) {
      const box = boxes.get(node.id)
      if (box) clampIntoView(node, box)
    }

    if (!moved) break
  }
}

function step(
  nodes: SimNode[],
  edges: GraphEdge[],
  boxes: Map<string, Box>,
  draggingId: string | null,
) {
  const byId = new Map(nodes.map((n) => [n.id, n]))

  for (const a of nodes) {
    for (const b of nodes) {
      if (a.id === b.id) continue
      const boxA = boxes.get(a.id)
      const boxB = boxes.get(b.id)
      if (!boxA || !boxB) continue

      const dx = a.x - b.x
      const dy = a.y - b.y
      const dist = Math.max(Math.hypot(dx, dy), 1)
      // Scale repulsion by footprint so wide labels claim proportionate space.
      const desired =
        (boxA.halfWidth + boxB.halfWidth + boxA.halfHeight + boxB.halfHeight) / 2 +
        NODE_GAP
      const force = Math.min((desired * desired) / (dist * dist), 40)
      a.vx += (dx / dist) * force * 0.05
      a.vy += (dy / dist) * force * 0.05
    }

    a.vx += (WIDTH / 2 - a.x) * 0.0015
    a.vy += (HEIGHT / 2 - a.y) * 0.0015
  }

  for (const edge of edges) {
    const a = byId.get(edge.source)
    const b = byId.get(edge.target)
    if (!a || !b) continue
    const boxA = boxes.get(a.id)
    const boxB = boxes.get(b.id)
    if (!boxA || !boxB) continue

    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.max(Math.hypot(dx, dy), 1)
    const rest = boxA.halfWidth + boxB.halfWidth + 60
    const pull = (dist - rest) * 0.01
    a.vx += dx * pull * 0.02
    a.vy += dy * pull * 0.02
    b.vx -= dx * pull * 0.02
    b.vy -= dy * pull * 0.02
  }

  for (const node of nodes) {
    if (draggingId === node.id) continue
    node.vx = Math.max(-6, Math.min(6, node.vx * 0.86))
    node.vy = Math.max(-6, Math.min(6, node.vy * 0.86))
    node.x += node.vx
    node.y += node.vy
    const box = boxes.get(node.id)
    if (box) clampIntoView(node, box)
  }

  separate(nodes, boxes)
}

/**
 * Deterministic starting ring, then enough simulation passes that the very
 * first paint is already settled and overlap-free — including for users with
 * reduced motion, who never see the animation run.
 */
function settledLayout(nodes: GraphNode[], edges: GraphEdge[]): SimNode[] {
  const visible = nodes.slice(0, MAX_NODES)
  const boxes = new Map(visible.map((node) => [node.id, boxFor(node)]))
  const placed: SimNode[] = visible.map((node, index) => {
    const angle = (index / Math.max(visible.length, 1)) * Math.PI * 2
    const radius = 150 + (index % 3) * 40
    return {
      ...node,
      x: WIDTH / 2 + Math.cos(angle) * radius,
      y: HEIGHT / 2 + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    }
  })

  for (const node of placed) {
    const box = boxes.get(node.id)
    if (box) clampIntoView(node, box)
  }

  for (let i = 0; i < 260; i += 1) {
    step(placed, edges, boxes, null)
  }
  return placed
}

export function FeedbackConstellation({
  nodes,
  edges,
  themes,
  reducedMotion = false,
}: FeedbackConstellationProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(nodes[0]?.id ?? null)
  const boxes = useMemo(
    () => new Map(nodes.slice(0, MAX_NODES).map((node) => [node.id, boxFor(node)])),
    [nodes],
  )
  const [positions, setPositions] = useState<SimNode[]>(() =>
    settledLayout(nodes, edges),
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
        step(next, edges, boxes, dragRef.current?.id ?? null)
        return next
      })
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [boxes, edges, reducedMotion])

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
    const scaleX = WIDTH / rect.width
    const scaleY = HEIGHT / rect.height
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
    const scaleX = WIDTH / rect.width
    const scaleY = HEIGHT / rect.height
    const x = (event.clientX - rect.left) * scaleX - drag.offsetX
    const y = (event.clientY - rect.top) * scaleY - drag.offsetY
    setPositions((prev) => {
      const next = prev.map((n) =>
        n.id === drag.id ? { ...n, x, y, vx: 0, vy: 0 } : { ...n },
      )
      const dragged = next.find((n) => n.id === drag.id)
      const box = dragged ? boxes.get(dragged.id) : undefined
      if (dragged && box) clampIntoView(dragged, box)
      // Neighbours yield to the node under the pointer instead of being
      // overlapped by it.
      separate(next, boxes)
      return next
    })
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
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
          const radius = radiusFor(node.mentions)
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
                y={radius + LABEL_HEIGHT - 1}
                fill="#ecfdf5"
                fontSize={LABEL_FONT_SIZE}
                fontWeight={600}
                stroke="#0b1f14"
                strokeWidth={3}
                paintOrder="stroke"
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
            <p className="mt-4 text-xs font-semibold tracking-wide text-emerald-200/80 uppercase">
              {selected.contributors.length}{' '}
              {selected.contributors.length === 1 ? 'quote' : 'quotes'}
            </p>
            {/* One quote per mention, so the list scrolls rather than pushing
                the rest of the slide off screen. */}
            <ul className="mt-2 max-h-80 space-y-3 overflow-y-auto pr-1">
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
