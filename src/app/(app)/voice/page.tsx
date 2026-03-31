"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { X, Mic, Volume2, VolumeX, ChevronDown, Shield, AlertCircle } from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { sendChatMessage } from "@/lib/api"
import { cn } from "@/lib/utils"
import { EMOTIONS } from "@/lib/constants"
import type { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from "@/types/web-speech"

type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error"

const emotionColors: Record<keyof typeof EMOTIONS, string> = {
  stressed: "bg-emotion-stressed",
  excited: "bg-emotion-excited",
  confused: "bg-emotion-confused",
  sad: "bg-emotion-sad",
  angry: "bg-emotion-angry",
  joyful: "bg-emotion-joyful",
  neutral: "bg-emotion-neutral",
}

export default function VoicePage() {
  const router = useRouter()
  const { language } = useNexus()
  const [voiceState, setVoiceState] = useState<VoiceState>("idle")
  const [emotion, setEmotion] = useState<keyof typeof EMOTIONS>("neutral")
  const [isMuted, setIsMuted] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [aiResponse, setAiResponse] = useState("")
  const [showTranscript, setShowTranscript] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // Check prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSupported(false)
      setError(language === "ar"
        ? "متصفحك لا يدعم التعرف على الصوت"
        : "Your browser doesn't support speech recognition")
    }
  }, [language])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      // Stop MediaStream tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      window.speechSynthesis?.cancel()
    }
  }, [])

  // Timer for recording duration
  useEffect(() => {
    if (voiceState === "listening") {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (voiceState === "idle") {
        setElapsedTime(0)
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [voiceState])

  // Audio level visualization
  const startAudioVisualization = useCallback(async () => {
    try {
      // Close existing AudioContext before creating a new one
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Store stream reference so we can stop tracks later
      streamRef.current = stream

      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)

      const updateLevel = () => {
        if (analyserRef.current && voiceState === "listening") {
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          setAudioLevel(average / 255)
          animationFrameRef.current = requestAnimationFrame(updateLevel)
        }
      }
      updateLevel()
    } catch {
      // Fallback to simulated audio level — store ref so it can be cleaned up on unmount
      if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current)
      fallbackIntervalRef.current = setInterval(() => {
        if (voiceState === "listening") {
          setAudioLevel(Math.random() * 0.8 + 0.2)
        }
      }, 100)
    }
  }, [voiceState])

  // Initialize speech recognition
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    recognitionRef.current = new SpeechRecognition()
    recognitionRef.current.continuous = true
    recognitionRef.current.interimResults = true
    recognitionRef.current.lang = language === "ar" ? "ar-AE" : "en-US"

    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ""
      let interimTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }

      setTranscript(finalTranscript || interimTranscript)
    }

    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Speech recognition error handled via UI state
      if (event.error === "not-allowed") {
        setError(language === "ar"
          ? "يرجى السماح بالوصول للميكروفون"
          : "Please allow microphone access")
      }
      setVoiceState("error")
    }

    recognitionRef.current.start()
    startAudioVisualization()
  }, [language, startAudioVisualization])

  // Process transcript and get AI response
  const processTranscript = useCallback(async (text: string) => {
    if (!text.trim()) {
      setVoiceState("idle")
      return
    }

    setVoiceState("processing")
    setError(null)

    try {
      // Call real chat API
      const response = await sendChatMessage(
        [{ role: "user", content: text }],
        { max_tokens: 500 }
      )

      setAiResponse(response.content)

      // Set emotion from API response
      if (response.emotion?.dominant) {
        const emotionKey = response.emotion.dominant as keyof typeof EMOTIONS
        if (emotionKey in EMOTIONS) {
          setEmotion(emotionKey)
        }
      }

      // Speak the response
      if (!isMuted && "speechSynthesis" in window) {
        setVoiceState("speaking")
        const utterance = new SpeechSynthesisUtterance(response.content)
        utterance.lang = language === "ar" ? "ar-AE" : "en-US"
        utterance.rate = 1.0
        utterance.pitch = 1.0

        utterance.onend = () => {
          setVoiceState("idle")
        }

        utterance.onerror = () => {
          setVoiceState("idle")
        }

        synthRef.current = utterance
        window.speechSynthesis.speak(utterance)
      } else {
        setVoiceState("idle")
      }
    } catch (err) {
      // Chat API error handled via UI state
      setError(language === "ar"
        ? "حدث خطأ في الاتصال بالخادم"
        : "Error connecting to server")
      setVoiceState("error")
    }
  }, [isMuted, language])

  // Handle tap to toggle recording
  const handleTap = useCallback(() => {
    setError(null)

    if (voiceState === "idle" || voiceState === "error") {
      setVoiceState("listening")
      setTranscript("")
      setAiResponse("")
      startListening()
    } else if (voiceState === "listening") {
      // Stop listening and process
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      setAudioLevel(0)
      processTranscript(transcript)
    } else if (voiceState === "speaking") {
      // Stop speaking
      window.speechSynthesis?.cancel()
      setVoiceState("idle")
    }
  }, [voiceState, transcript, startListening, processTranscript])

  const handleClose = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    window.speechSynthesis?.cancel()
    router.back()
  }

  const handleMute = () => {
    setIsMuted(!isMuted)
    if (!isMuted && voiceState === "speaking") {
      window.speechSynthesis?.cancel()
      setVoiceState("idle")
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Generate ring scales based on audio level
  const ringScales = Array.from({ length: 5 }, (_, i) => {
    const baseScale = 1 + (i + 1) * 0.15
    const audioMultiplier = audioLevel * 0.3 * (i + 1)
    return baseScale + audioMultiplier
  })

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center overflow-hidden safe-area-inset">
      {/* Close Button */}
      <button
        onClick={handleClose}
        className="absolute top-6 end-6 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        aria-label={language === "ar" ? "إغلاق" : "Close"}
      >
        <X className="h-6 w-6 text-white" aria-hidden="true" />
      </button>

      {/* Mute Button */}
      <button
        onClick={handleMute}
        className="absolute top-6 start-6 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        aria-label={isMuted ? (language === "ar" ? "إلغاء الكتم" : "Unmute") : (language === "ar" ? "كتم" : "Mute")}
      >
        {isMuted ? (
          <VolumeX className="h-6 w-6 text-white" aria-hidden="true" />
        ) : (
          <Volume2 className="h-6 w-6 text-white" aria-hidden="true" />
        )}
      </button>

      {/* Current Emotion Indicator */}
      <div className="absolute top-6 inset-x-0 flex justify-center pointer-events-none">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10">
          <div className={cn("w-3 h-3 rounded-full", emotionColors[emotion])} />
          <span className="text-sm text-white/80">
            {language === "ar" ? EMOTIONS[emotion].labelAr : EMOTIONS[emotion].label}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="absolute top-20 inset-x-4 flex justify-center">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Main Orb */}
      <div className="relative">
        {/* Animated Rings */}
        {ringScales.map((scale, i) => (
          prefersReducedMotion ? (
            <div
              key={i}
              className={cn(
                "absolute inset-0 rounded-full border",
                voiceState === "speaking"
                  ? "border-nexus-jade/40"
                  : voiceState === "listening"
                  ? "border-nexus-jade/40"
                  : voiceState === "error"
                  ? "border-red-500/40"
                  : "border-white/20"
              )}
              style={{
                width: 200,
                height: 200,
                transform: `scale(${1 + (i + 1) * 0.15})`,
                opacity: 1 - i * 0.15,
              }}
            />
          ) : (
            <motion.div
              key={i}
              className={cn(
                "absolute inset-0 rounded-full border",
                voiceState === "speaking"
                  ? "border-nexus-jade/40"
                  : voiceState === "listening"
                  ? "border-nexus-jade/40"
                  : voiceState === "error"
                  ? "border-red-500/40"
                  : "border-white/20"
              )}
              animate={{
                scale,
                opacity: 1 - i * 0.15,
              }}
              transition={{
                duration: 0.1,
                ease: "easeOut",
              }}
              style={{
                width: 200,
                height: 200,
              }}
            />
          )
        ))}

        {/* Main Circle Button */}
        <motion.button
          onClick={handleTap}
          disabled={!isSupported || voiceState === "processing"}
          className={cn(
            "relative w-[200px] h-[200px] rounded-full flex items-center justify-center transition-colors",
            voiceState === "idle" && "bg-nexus-jade hover:bg-nexus-jade-hover",
            voiceState === "listening" && "bg-nexus-jade",
            voiceState === "processing" && "bg-muted motion-safe:animate-pulse",
            voiceState === "speaking" && "bg-nexus-jade",
            voiceState === "error" && "bg-red-500/80 hover:bg-red-500",
            !isSupported && "bg-muted cursor-not-allowed"
          )}
          whileTap={{ scale: 0.95 }}
          aria-label={
            voiceState === "idle"
              ? (language === "ar" ? "اضغط للتحدث" : "Tap to speak")
              : voiceState === "listening"
              ? (language === "ar" ? "اضغط للإرسال" : "Tap to send")
              : voiceState === "error"
              ? (language === "ar" ? "اضغط للمحاولة مجدداً" : "Tap to retry")
              : (language === "ar" ? "جاري المعالجة" : "Processing")
          }
        >
          {voiceState === "listening" ? (
            <Mic className="h-16 w-16 text-background" aria-hidden="true" />
          ) : voiceState === "speaking" ? (
            <Volume2 className="h-16 w-16 text-background" aria-hidden="true" />
          ) : voiceState === "error" ? (
            <AlertCircle className="h-16 w-16 text-background" aria-hidden="true" />
          ) : (
            <Mic className="h-16 w-16 text-background" aria-hidden="true" />
          )}
        </motion.button>
      </div>

      {/* Status Text */}
      <div className="mt-8 text-center" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.p
            key={voiceState}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            className="text-xl text-white"
          >
            {voiceState === "idle" && (language === "ar" ? "اضغط للتحدث" : "Tap to speak")}
            {voiceState === "listening" && (language === "ar" ? "جاري الاستماع..." : "Listening...")}
            {voiceState === "processing" && (language === "ar" ? "جاري المعالجة..." : "Processing...")}
            {voiceState === "speaking" && (language === "ar" ? "يتحدث NexusAD Ai..." : "NexusAD Ai speaking...")}
            {voiceState === "error" && (language === "ar" ? "حدث خطأ - اضغط للمحاولة" : "Error - tap to retry")}
          </motion.p>
        </AnimatePresence>

        {voiceState === "listening" && (
          <p className="mt-2 text-sm text-white/60">{formatTime(elapsedTime)}</p>
        )}
      </div>

      {/* Transcript Drawer */}
      <div className="absolute bottom-0 inset-x-0 z-10">
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="w-full py-3 flex items-center justify-center gap-2 text-white/60 hover:text-white transition-colors"
          aria-expanded={showTranscript}
        >
          <ChevronDown className={cn("h-5 w-5 transition-transform", showTranscript && "rotate-180")} aria-hidden="true" />
          <span className="text-sm">{language === "ar" ? "عرض النص" : "Show Transcript"}</span>
        </button>

        <AnimatePresence>
          {showTranscript && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-card/90 backdrop-blur-lg border-t border-border overflow-hidden"
            >
              <div className="p-6 max-h-[40vh] overflow-y-auto">
                {transcript && (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      {language === "ar" ? "أنت" : "You"}
                    </p>
                    <p className="text-body text-foreground">{transcript}</p>
                  </div>
                )}

                {aiResponse && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      NexusAD Ai
                    </p>
                    <p className="text-body text-foreground">{aiResponse}</p>
                  </div>
                )}

                {!transcript && !aiResponse && (
                  <p className="text-muted-foreground text-center">
                    {language === "ar" ? "لا يوجد نص بعد" : "No transcript yet"}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sovereignty Badge */}
      <div className="absolute bottom-20 inset-x-0 flex justify-center pointer-events-none">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5">
          <Shield className="h-4 w-4 text-nexus-gold" aria-hidden="true" />
          <span className="text-xs text-white/60">
            {language === "ar" ? "مشفر من طرف إلى طرف" : "End-to-end encrypted"}
          </span>
        </div>
      </div>
    </div>
  )
}

// Web Speech API types are declared in @/types/web-speech.d.ts
