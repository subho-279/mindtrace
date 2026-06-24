import { useRef, useState, useCallback } from 'react'

export function useWebcam() {
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const [active, setActive]   = useState(false)
  const [error,  setError]    = useState(null)

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setActive(true)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setActive(false)
  }, [])

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || !active) return null
    const canvas = document.createElement('canvas')
    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  }, [active])

  return { videoRef, active, error, start, stop, captureFrame }
}
