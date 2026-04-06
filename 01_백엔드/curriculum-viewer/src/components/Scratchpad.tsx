import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import './Scratchpad.css'

type Point = { x: number; y: number }
type Stroke = { points: Point[]; width: number; color: string }

export interface ScratchpadHandle {
  getStrokesJson: () => string
  loadStrokesJson: (json: string | null) => void
  clear: () => void
}

interface ScratchpadProps {
  problemNumber: number | null
  onStrokeStart?: () => void
  onStrokesChange?: (strokesJson: string) => void
  readOnly?: boolean
  strokesJson?: string | null
}

const PEN_WIDTHS = [2, 4, 6]
const PEN_COLOR = '#222'

const Scratchpad = forwardRef<ScratchpadHandle, ScratchpadProps>(function Scratchpad(
  { problemNumber, onStrokeStart, onStrokesChange, readOnly = false, strokesJson },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [penWidth, setPenWidth] = useState(PEN_WIDTHS[1])
  const isDrawingRef = useRef(false)
  const isJsdomEnv = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)

  const applyStrokesJson = (json: string | null) => {
    isDrawingRef.current = false
    setCurrentStroke(null)
    if (!json) {
      setStrokes([])
      return
    }
    try {
      const parsed = JSON.parse(json)
      if (Array.isArray(parsed)) {
        setStrokes(parsed)
        return
      }
    } catch {
      // ignore
    }
    setStrokes([])
  }

  useImperativeHandle(ref, () => ({
    getStrokesJson: () => JSON.stringify(strokes),
    loadStrokesJson: (json: string | null) => applyStrokesJson(json),
    clear: () => applyStrokesJson(null)
  }))

  // 외부에서 strokesJson이 주어지면 그대로 렌더링 (읽기 전용 뷰어 용도)
  useEffect(() => {
    if (strokesJson === undefined) return
    applyStrokesJson(strokesJson)
  }, [strokesJson])

  // strokes 변경 시 상위에 JSON으로 알림 (자동 저장용)
  useEffect(() => {
    onStrokesChange?.(JSON.stringify(strokes))
  }, [onStrokesChange, strokes])

  // 캔버스 리사이즈
  useEffect(() => {
    if (isJsdomEnv) return
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      let ctx: CanvasRenderingContext2D | null = null
      try {
        ctx = canvas.getContext('2d')
      } catch {
        ctx = null
      }
      if (ctx) {
        ctx.scale(dpr, dpr)
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  // 스트로크 그리기
  useEffect(() => {
    if (isJsdomEnv) return
    const canvas = canvasRef.current
    if (!canvas) return
    let ctx: CanvasRenderingContext2D | null = null
    try {
      ctx = canvas.getContext('2d')
    } catch {
      ctx = null
    }
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)

    const drawStroke = (stroke: Stroke) => {
      if (stroke.points.length < 2) return
      ctx.beginPath()
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      ctx.stroke()
    }

    for (const stroke of strokes) {
      drawStroke(stroke)
    }
    if (currentStroke) {
      drawStroke(currentStroke)
    }
  }, [strokes, currentStroke])

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.setPointerCapture(e.pointerId)
    isDrawingRef.current = true

    const pos = getPointerPos(e)
    setCurrentStroke({
      points: [pos],
      width: penWidth,
      color: PEN_COLOR
    })

    onStrokeStart?.()
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return
    if (!isDrawingRef.current || !currentStroke) return
    e.preventDefault()

    const pos = getPointerPos(e)
    setCurrentStroke((prev) => {
      if (!prev) return null
      return { ...prev, points: [...prev.points, pos] }
    })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return
    if (!isDrawingRef.current) return
    e.preventDefault()

    const canvas = canvasRef.current
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId)
    }

    isDrawingRef.current = false
    if (currentStroke && currentStroke.points.length >= 2) {
      setStrokes((prev) => [...prev, currentStroke])
    }
    setCurrentStroke(null)
  }

  const handleUndo = () => {
    if (readOnly) return
    setStrokes((prev) => prev.slice(0, -1))
  }

  const handleClear = () => {
    if (readOnly) return
    setStrokes([])
  }

  return (
    <div className={`scratchpad ${readOnly ? 'readonly' : ''}`}>
      <div className="scratchpad-header">
        <span className="scratchpad-title">
          {problemNumber !== null ? `${problemNumber}번 메모` : '메모장'}
        </span>
      </div>

      {!readOnly ? (
        <div className="scratchpad-toolbar">
          <div className="scratchpad-pen-sizes">
            {PEN_WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                className={`scratchpad-pen-btn ${penWidth === w ? 'active' : ''}`}
                onClick={() => setPenWidth(w)}
                title={`펜 굵기 ${w}`}
              >
                <span
                  className="scratchpad-pen-dot"
                  style={{ width: w * 2, height: w * 2 }}
                />
              </button>
            ))}
          </div>

          <div className="scratchpad-actions">
            <button
              type="button"
              className="scratchpad-btn"
              onClick={handleUndo}
              disabled={strokes.length === 0}
            >
              되돌리기
            </button>
            <button
              type="button"
              className="scratchpad-btn scratchpad-btn-danger"
              onClick={handleClear}
              disabled={strokes.length === 0}
            >
              전체 지우기
            </button>
          </div>
        </div>
      ) : null}

      <canvas
        ref={canvasRef}
        className="scratchpad-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  )
})

export default Scratchpad
