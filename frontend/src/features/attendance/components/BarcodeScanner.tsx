import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff } from 'lucide-react'

type DetectedBarcode = { rawValue: string }
type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>
}
type BarcodeDetectorConstructor = new (options?: {
  formats?: string[]
}) => BarcodeDetectorLike

function detectorConstructor(): BarcodeDetectorConstructor | null {
  return (
    (
      window as typeof window & {
        BarcodeDetector?: BarcodeDetectorConstructor
      }
    ).BarcodeDetector ?? null
  )
}

type BarcodeScannerProps = {
  active: boolean
  disabled?: boolean
  onScan: (studentId: string) => void
}

/**
 * Camera barcode reader for the shared iPad/MacBook kiosk.
 *
 * It asks for the front camera as requested, but keeps a manual keypad visible
 * outside this component because BarcodeDetector is not available in every
 * iPhone/Safari version. Frames never leave the device.
 */
export function BarcodeScanner({
  active,
  disabled = false,
  onScan,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const onScanRef = useRef(onScan)
  const lastValueRef = useRef<{ value: string; at: number } | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    if (!active || disabled) return
    const Detector = detectorConstructor()
    if (!Detector) {
      setMessage(
        'This browser does not support camera barcode detection. Use the keypad below.',
      )
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Camera access is unavailable. Use the keypad below.')
      return
    }

    let cancelled = false
    let frame = 0
    let lastDetectionAt = 0
    const detector = new Detector({
      formats: ['code_128', 'code_39', 'codabar', 'ean_13', 'qr_code'],
    })

    const stop = () => {
      window.cancelAnimationFrame(frame)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    const tick = async (timestamp: number) => {
      if (cancelled) return
      const video = videoRef.current
      if (video?.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
        if (timestamp - lastDetectionAt >= 250) {
          lastDetectionAt = timestamp
          try {
            const detected = await detector.detect(video)
            const value = detected[0]?.rawValue?.trim()
            const previous = lastValueRef.current
            if (
              value &&
              (!previous ||
                previous.value !== value ||
                Date.now() - previous.at > 4_000)
            ) {
              lastValueRef.current = { value, at: Date.now() }
              onScanRef.current(value)
            }
          } catch {
            // Some browsers throw while the video changes dimensions. The next
            // animation frame is safe to try again.
          }
        }
      }
      frame = window.requestAnimationFrame((next) => void tick(next))
    }

    void navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        setMessage(null)
        frame = window.requestAnimationFrame((timestamp) => void tick(timestamp))
      })
      .catch(() => {
        setMessage(
          'Camera permission was denied or no front camera was found. Use the keypad below.',
        )
      })

    return () => {
      cancelled = true
      stop()
    }
  }, [active, disabled])

  if (!active) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-card border border-dashed border-border-strong bg-surface-sunken text-sm text-ink-muted">
        <CameraOff size={18} className="mr-2" aria-hidden="true" />
        Camera scanner off
      </div>
    )
  }

  return (
    <div className="relative min-h-48 overflow-hidden rounded-card bg-black">
      <video
        ref={videoRef}
        muted
        playsInline
        aria-label="Front camera barcode scanner"
        className="aspect-video h-full w-full object-cover -scale-x-100"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[18%] rounded-card border-2 border-white/80 shadow-[0_0_0_999px_rgb(0_0_0/0.32)]"
      />
      <p className="absolute right-3 bottom-3 left-3 rounded-control bg-black/65 px-3 py-2 text-center text-xs text-white">
        <Camera size={14} className="mr-1 inline" aria-hidden="true" />
        Hold the student ID barcode inside the frame
      </p>
      {message ? (
        <p className="absolute inset-x-3 top-3 rounded-control bg-status-warning-bg px-3 py-2 text-xs text-status-warning">
          {message}
        </p>
      ) : null}
    </div>
  )
}
