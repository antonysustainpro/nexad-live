"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Mic, X, Edit3, Headphones, Play, Pause, Volume2 } from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from "@/types/web-speech"
import { speak } from "@/lib/api"

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  useEffect(() => {
    setPrefersReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])
  return prefersReducedMotion
}

interface VoiceCounselInterfaceProps {
  isOpen: boolean
  onClose: () => void
  onSend: (text: string, mode: "fast" | "thinking" | "pro") => void
}

type VoiceState = "idle" | "listening" | "processing" | "transcribed" | "error"

export function VoiceCounselInterface({
  isOpen,
  onClose,
  onSend,
}: VoiceCounselInterfaceProps) {
  const { language, isRTL } = useNexus()
  const [voiceState, setVoiceState] = useState<VoiceState>("idle")
  const [transcribedText, setTranscribedText] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState("")
  const [selectedLanguage, setSelectedLanguage] = useState<"EN" | "AR">(language === "ar" ? "AR" : "EN")
  const [audioLevel, setAudioLevel] = useState(0)
  const [errorMessage, setErrorMessage] = useState("")
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  // SEC-SM-R3-006: Track MediaStreamSource for proper cleanup to prevent memory leaks.
  // Without disconnecting the source node, the AudioContext retains a reference to the
  // MediaStream, preventing garbage collection of the audio processing graph.
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      // SEC-SM-R3-006: Disconnect source node before closing AudioContext
      sourceNodeRef.current?.disconnect()
      sourceNodeRef.current = null
      audioContextRef.current?.close()
    }
  }, [])

  // Start listening when opened
  useEffect(() => {
    if (isOpen && voiceState === "idle") {
      startListening()
    }
  }, [isOpen])

  const startListening = async () => {
    setVoiceState("listening")
    setErrorMessage("")

    const SpeechRecognitionAPI =
      (typeof window !== "undefined" &&
        (window.SpeechRecognition || window.webkitSpeechRecognition)) ||
      null

    if (!SpeechRecognitionAPI) {
      setErrorMessage(
        language === "ar"
          ? "التعرف على الصوت غير مدعوم في هذا المتصفح."
          : "Voice recognition is not supported in this browser."
      )
      setVoiceState("error")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      // SEC-SM-R3-006: Store source node ref for proper cleanup
      sourceNodeRef.current = source
      analyserRef.current.fftSize = 256

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)

      const updateLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          setAudioLevel(average / 255)
          animationFrameRef.current = requestAnimationFrame(updateLevel)
        }
      }
      updateLevel()

      const recognition = new SpeechRecognitionAPI()
      recognitionRef.current = recognition
      recognition.lang = selectedLanguage === "AR" ? "ar-AE" : "en-US"
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript.trim()
        stream.getTracks().forEach((track) => track.stop())
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
        setAudioLevel(0)
        if (transcript) {
          setTranscribedText(transcript)
          setEditedText(transcript)
          setVoiceState("transcribed")
        } else {
          setErrorMessage(
            language === "ar"
              ? "لم يتم التعرف على أي كلام. يرجى المحاولة مجدداً."
              : "No speech was detected. Please try again."
          )
          setVoiceState("error")
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        stream.getTracks().forEach((track) => track.stop())
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
        setAudioLevel(0)
        const msg =
          event.error === "not-allowed"
            ? (language === "ar"
                ? "تم رفض إذن الميكروفون. يرجى السماح بالوصول إلى الميكروفون وإعادة المحاولة."
                : "Microphone permission was denied. Please allow microphone access and try again.")
            : (language === "ar"
                ? "حدث خطأ أثناء التعرف على الصوت. يرجى المحاولة مجدداً."
                : "An error occurred during voice recognition. Please try again.")
        setErrorMessage(msg)
        setVoiceState("error")
      }

      recognition.onend = () => {
        stream.getTracks().forEach((track) => track.stop())
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
        setAudioLevel(0)
      }

      recognition.start()
    } catch {
      setErrorMessage(
        language === "ar"
          ? "تعذّر الوصول إلى الميكروفون. يرجى التحقق من الأذونات وإعادة المحاولة."
          : "Could not access the microphone. Please check your permissions and try again."
      )
      setVoiceState("error")
    }
  }

  const handleStopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    // SEC-SM-R3-006: Disconnect source node on stop to prevent memory leak
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }
    setVoiceState("processing")
    setAudioLevel(0)
  }, [])

  const handleSend = (mode: "fast" | "thinking" | "pro") => {
    const textToSend = isEditing ? editedText : transcribedText
    onSend(textToSend, mode)
    handleClose()
  }

  const handleClose = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    // SEC-SM-R3-006: Disconnect source node to release audio processing graph
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }
    setVoiceState("idle")
    setTranscribedText("")
    setEditedText("")
    setIsEditing(false)
    setAudioLevel(0)
    setErrorMessage("")
    onClose()
  }

  const toggleLanguage = () => {
    setSelectedLanguage(prev => prev === "EN" ? "AR" : "EN")
  }

  const prefersReducedMotion = usePrefersReducedMotion()

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(10, 22, 40, 0.95)" }}
        role="dialog"
        aria-modal="true"
        aria-label={language === "ar" ? "الإدخال الصوتي" : "Voice input"}
        onClick={(e) => {
          if (e.target === e.currentTarget && voiceState === "listening") {
            handleStopListening()
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            handleClose()
          }
          // Focus trap
          if (e.key === "Tab") {
            const dialog = e.currentTarget
            const focusableElements = dialog.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
            const firstEl = focusableElements[0]
            const lastEl = focusableElements[focusableElements.length - 1]
            if (e.shiftKey && document.activeElement === firstEl) {
              e.preventDefault()
              lastEl?.focus()
            } else if (!e.shiftKey && document.activeElement === lastEl) {
              e.preventDefault()
              firstEl?.focus()
            }
          }
        }}
      >
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-md mx-4"
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute -top-12 right-0 p-2 rounded-full bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] transition-colors"
            aria-label={language === "ar" ? "إغلاق" : "Close voice input"}
          >
            <X className="h-5 w-5 text-white" />
          </button>

          {/* Listening State */}
          {voiceState === "listening" && (
            <div className="flex flex-col items-center">
              {/* Pulsing circle with rings */}
              <div className="relative mb-8">
                {/* Concentric rings */}
                {[1, 2, 3].map((ring) => (
                  prefersReducedMotion ? (
                    <div
                      key={ring}
                      className="absolute inset-0 rounded-full border-2 border-[#FF006E]"
                      style={{
                        width: 80 + ring * 30,
                        height: 80 + ring * 30,
                        marginLeft: -(ring * 15),
                        marginTop: -(ring * 15),
                        opacity: 0.3 - ring * 0.08,
                      }}
                    />
                  ) : (
                    <motion.div
                      key={ring}
                      className="absolute inset-0 rounded-full border-2 border-[#FF006E]"
                      style={{
                        width: 80 + ring * 30,
                        height: 80 + ring * 30,
                        marginLeft: -(ring * 15),
                        marginTop: -(ring * 15),
                      }}
                      animate={{
                        scale: [1, 1.1 + audioLevel * 0.5, 1],
                        opacity: [0.3 - ring * 0.08, 0.5 - ring * 0.1, 0.3 - ring * 0.08],
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: ring * 0.2,
                      }}
                    />
                  )
                ))}
                
                {/* Main circle */}
                <motion.button
                  onClick={handleStopListening}
                  aria-label={language === "ar" ? "إيقاف الاستماع" : "Stop listening"}
                  className="relative w-20 h-20 rounded-full bg-[#FF006E] flex items-center justify-center"
                  animate={{
                    scale: [1, 1 + audioLevel * 0.2, 1],
                  }}
                  transition={{ duration: 0.1 }}
                >
                  <Mic className="h-8 w-8 text-white" />
                </motion.button>
              </div>

              {/* Listening text */}
              {prefersReducedMotion ? (
                <p className="text-base text-white mb-2">
                  {language === "ar" ? "جاري الاستماع..." : "Listening..."}
                </p>
              ) : (
                <motion.p
                  className="text-base text-white mb-2"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {language === "ar" ? "جاري الاستماع" : "Listening"}
                  <span className="inline-flex">
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}>.</motion.span>
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}>.</motion.span>
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}>.</motion.span>
                  </span>
                </motion.p>
              )}

              {/* Audio waveform visualization */}
              <div className="flex items-center gap-1 h-8 mb-6" aria-hidden="true">
                {prefersReducedMotion ? (
                  Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-[#FF006E] rounded-full"
                      style={{ height: 4 + (audioLevel * 20) }}
                    />
                  ))
                ) : (
                  Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-[#FF006E] rounded-full"
                      animate={{
                        height: [4, 4 + Math.random() * 20 * (1 + audioLevel), 4],
                      }}
                      transition={{
                        duration: 0.3,
                        repeat: Infinity,
                        delay: i * 0.05,
                      }}
                    />
                  ))
                )}
              </div>

              {/* Language selector */}
              <button
                onClick={toggleLanguage}
                className="px-4 py-2 rounded-full bg-[rgba(255,255,255,0.1)] text-white text-sm font-medium hover:bg-[rgba(255,255,255,0.2)] transition-colors"
                aria-label={selectedLanguage === "EN" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}
              >
                {selectedLanguage}
              </button>

              <p className="mt-6 text-xs text-[#94A3B8]">
                {language === "ar" ? "انقر في أي مكان للإلغاء" : "Tap anywhere to cancel"}
              </p>
            </div>
          )}

          {/* Processing State */}
          {voiceState === "processing" && (
            <div className="flex flex-col items-center">
              <motion.div
                className="w-12 h-12 rounded-full bg-[#FF006E] flex items-center justify-center mb-4"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full" />
              </motion.div>
              <p className="text-base text-white">
                {language === "ar" ? "جاري معالجة استفسارك..." : "Processing your query..."}
              </p>
            </div>
          )}

          {/* Error State */}
          {voiceState === "error" && (
            <div className="flex flex-col items-center text-center px-4">
              <div className="w-14 h-14 rounded-full bg-[rgba(255,0,110,0.15)] border border-[#FF006E] flex items-center justify-center mb-4">
                <Mic className="h-6 w-6 text-[#FF006E]" />
              </div>
              <p className="text-sm text-white mb-2">
                {language === "ar" ? "تعذّر التعرف على الصوت" : "Voice recognition failed"}
              </p>
              <p className="text-xs text-[#94A3B8] mb-6">{errorMessage}</p>
              <Button
                onClick={() => {
                  setErrorMessage("")
                  setVoiceState("idle")
                  startListening()
                }}
                variant="outline"
                className="border-[rgba(255,255,255,0.2)] text-white hover:bg-[rgba(255,255,255,0.1)]"
              >
                {language === "ar" ? "حاول مجدداً" : "Try again"}
              </Button>
            </div>
          )}

          {/* Transcribed State */}
          {voiceState === "transcribed" && (
            <div className="w-full">
              {/* Transcribed text card */}
              <div 
                className="p-4 rounded-xl mb-4"
                style={{
                  background: "rgba(15, 29, 50, 0.8)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#94A3B8]">
                    {language === "ar" ? "استفسارك:" : "Your query:"}
                  </span>
                  <button
                    onClick={() => {
                      setIsEditing(!isEditing)
                      if (!isEditing) setEditedText(transcribedText)
                    }}
                    className="p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                    aria-label={isEditing ? (language === "ar" ? "إلغاء التعديل" : "Cancel editing") : (language === "ar" ? "تعديل النص" : "Edit transcription")}
                  >
                    <Edit3 className="h-4 w-4 text-[#94A3B8]" />
                  </button>
                </div>
                
                {isEditing ? (
                  <Textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="bg-[#0A1628] border-[rgba(255,255,255,0.08)] min-h-[80px] text-white"
                    autoFocus
                  />
                ) : (
                  <p className="text-sm text-white">{transcribedText}</p>
                )}
              </div>

              {/* Mode selection buttons */}
              <div className="space-y-2">
                <p className="text-xs text-[#94A3B8] text-center mb-3">
                  {language === "ar" ? "اختر وضع الإرسال" : "Send as:"}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    onClick={() => handleSend("fast")}
                    variant="outline"
                    className="border-[rgba(255,255,255,0.2)] text-white hover:bg-[rgba(255,255,255,0.1)]"
                  >
                    {language === "ar" ? "سريع" : "Fast"}
                  </Button>
                  <Button
                    onClick={() => handleSend("thinking")}
                    variant="outline"
                    className="border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB]/10"
                  >
                    {language === "ar" ? "تفكير" : "Thinking"}
                  </Button>
                  <Button
                    onClick={() => handleSend("pro")}
                    className="bg-gradient-to-r from-[#D4A574] to-[#B8860B] text-white hover:opacity-90"
                  >
                    {language === "ar" ? "احترافي" : "Pro"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Voice trigger button for chat input
export function VoiceCounselTrigger({ 
  onClick,
  disabled 
}: { 
  onClick: () => void
  disabled?: boolean 
}) {
  const { language } = useNexus()
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
        "border border-[#2563EB]",
        disabled 
          ? "bg-[#0A1628]/50 opacity-50 cursor-not-allowed"
          : "bg-[#0A1628] hover:bg-[#2563EB]/20 hover:border-[#2563EB]"
      )}
      style={{
        background: "rgba(15, 29, 50, 0.8)",
        backdropFilter: "blur(12px)",
      }}
      aria-label={language === "ar" ? "البدء بالصوت" : "Start voice input"}
    >
      <Mic className="h-5 w-5 text-[#2563EB]" />
    </button>
  )
}

// Voice response player for AI responses
interface VoiceResponsePlayerProps {
  responseText: string
  isExecutiveSummary?: boolean
  className?: string
}

export function VoiceResponsePlayer({
  responseText,
  isExecutiveSummary = false,
  className,
}: VoiceResponsePlayerProps) {
  const { language } = useNexus()
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup audio resources
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      cleanupAudio()
    }
  }, [cleanupAudio])

  // Reset player when responseText changes
  useEffect(() => {
    abortControllerRef.current?.abort()
    cleanupAudio()
    setIsPlaying(false)
    setIsLoading(false)
    setProgress(0)
  }, [responseText, cleanupAudio])

  const handlePlayPause = async () => {
    // If already have an audio element loaded, toggle play/pause
    if (audioRef.current && audioRef.current.src) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.playbackRate = playbackSpeed
        audioRef.current.play()
        setIsPlaying(true)
      }
      return
    }

    // Otherwise fetch TTS audio
    setIsLoading(true)
    abortControllerRef.current = new AbortController()

    try {
      const blob = await speak(responseText, "default", "neutral", abortControllerRef.current.signal)

      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio
      audio.playbackRate = playbackSpeed

      audio.addEventListener("timeupdate", () => {
        if (audio.duration && audio.duration > 0) {
          setProgress((audio.currentTime / audio.duration) * 100)
        }
      })

      audio.addEventListener("ended", () => {
        setIsPlaying(false)
        setProgress(0)
      })

      audio.addEventListener("error", () => {
        setIsPlaying(false)
        setIsLoading(false)
        setProgress(0)
      })

      await audio.play()
      setIsPlaying(true)
    } catch (err) {
      // AbortError means the user navigated away or text changed — not an error
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("TTS playback error:", err)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const cycleSpeed = () => {
    setPlaybackSpeed(prev => {
      const next = prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1
      if (audioRef.current) {
        audioRef.current.playbackRate = next
      }
      return next
    })
  }

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg",
      "bg-[#0A1628] border border-[rgba(255,255,255,0.08)]",
      className
    )}>
      <button
        onClick={handlePlayPause}
        disabled={isLoading}
        aria-label={isLoading ? (language === "ar" ? "جاري التحميل" : "Loading audio") : isPlaying ? (language === "ar" ? "إيقاف مؤقت" : "Pause") : (language === "ar" ? "تشغيل" : "Play")}
        className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center hover:bg-[#2563EB]/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <motion.div
            className="w-3 h-3 border-2 border-white border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
        ) : isPlaying ? (
          <Pause className="h-4 w-4 text-white" />
        ) : (
          <Play className="h-4 w-4 text-white ms-0.5" />
        )}
      </button>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Headphones className="h-3 w-3 text-[#94A3B8]" />
          <span className="text-xs text-[#94A3B8]">
            {isExecutiveSummary
              ? (language === "ar" ? "الاستماع للملخص التنفيذي" : "Listen to Executive Summary")
              : (language === "ar" ? "الاستماع للرد" : "Listen to response")
            }
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#2563EB]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Speed selector */}
      <button
        onClick={cycleSpeed}
        className="px-2 py-1 rounded text-xs text-[#94A3B8] hover:text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors"
        aria-label={language === "ar" ? `سرعة التشغيل: ${playbackSpeed}x` : `Playback speed: ${playbackSpeed}x`}
      >
        {playbackSpeed}x
      </button>

      <Volume2 className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
    </div>
  )
}
