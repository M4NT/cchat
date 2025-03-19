"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Mic, Square, Loader2, Send, RefreshCw, Play, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void
  onCancel?: () => void
}

export default function AudioRecorder({ onRecordingComplete, onCancel }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [finalRecordingTime, setFinalRecordingTime] = useState(0)
  const [isInitializing, setIsInitializing] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioChunks = useRef<Blob[]>([])
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  const audioPlayer = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  // Iniciar gravação automaticamente ao montar o componente
  useEffect(() => {
    startRecording();

    return () => {
      cleanup();
    }
  }, [])

  // Limpar recursos ao desmontar
  const cleanup = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
    
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
    }
    
    // Liberar URL de objeto para evitar vazamento de memória
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  }

  const startRecording = async () => {
    // Limpar qualquer áudio anterior
    if (audioBlob) {
      setAudioBlob(null);
      setAudioUrl(null);
    }
    
    setIsInitializing(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder.current = new MediaRecorder(stream)
      audioChunks.current = []

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data)
      }

      mediaRecorder.current.onstop = () => {
        // Certifique-se de parar o cronômetro imediatamente
        if (timerInterval.current) {
          clearInterval(timerInterval.current);
          timerInterval.current = null;
        }
        
        // Armazena o tempo final da gravação
        setFinalRecordingTime(recordingTime);
        
        const newAudioBlob = new Blob(audioChunks.current, { type: "audio/mpeg" })
        setAudioBlob(newAudioBlob)
        
        // Criar URL do áudio para preview
        const url = URL.createObjectURL(newAudioBlob);
        setAudioUrl(url);
        
        // Limpa o estado de gravação
        setIsRecording(false)
        
        // Para todas as tracks do stream
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.current.start()
      setIsRecording(true)
      setRecordingTime(0)
      setFinalRecordingTime(0)

      // Inicia o timer com referência de tempo
      const startTime = Date.now();
      timerInterval.current = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        setRecordingTime(elapsedSeconds);
      }, 1000)
    } catch (error) {
      console.error("Error accessing microphone:", error)
      // Se falhar em iniciar a gravação, chama onCancel
      if (onCancel) {
        onCancel();
      }
    } finally {
      setIsInitializing(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop()
      
      // Limpa o timer imediatamente para garantir que o cronômetro pare
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
        timerInterval.current = null
      }
    }
  }

  const handleSendAudio = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob)
      
      // Limpar o estado após enviar
      setAudioBlob(null)
      setRecordingTime(0)
      setFinalRecordingTime(0)
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
    }
  }

  const handleRerecord = () => {
    // Limpar dados atuais e iniciar nova gravação
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
    setRecordingTime(0);
    setFinalRecordingTime(0);
    startRecording();
  }

  const handleCancel = () => {
    // Limpar recursos
    cleanup();
    
    // Chamar callback de cancelamento
    if (onCancel) {
      onCancel();
    }
  }

  const togglePlayPreview = () => {
    if (!audioPlayer.current || !audioUrl) return;
    
    if (isPlaying) {
      audioPlayer.current.pause();
    } else {
      audioPlayer.current.play();
    }
    
    setIsPlaying(!isPlaying);
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  return (
    <div className="flex flex-col space-y-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
      {/* Player de áudio invisível para preview */}
      {audioUrl && (
        <audio 
          ref={audioPlayer} 
          src={audioUrl} 
          onEnded={() => setIsPlaying(false)} 
          className="hidden"
        />
      )}
      
      {isInitializing ? (
        <div className="flex items-center space-x-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Iniciando gravação...</span>
        </div>
      ) : isRecording ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button 
              onClick={stopRecording} 
              variant="ghost" 
              size="icon"
              className="bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30"
            >
              <Square className="h-5 w-5 text-red-500" />
            </Button>
            <div className="text-sm font-medium text-red-500 animate-pulse">
              {formatTime(recordingTime)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500">Gravando...</div>
            <Button onClick={handleCancel} variant="ghost" size="sm" className="h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : audioBlob ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex-1 text-sm font-medium">
              Áudio pronto para envio ({formatTime(finalRecordingTime)})
            </div>
            <div className="flex space-x-1">
              <Button 
                onClick={togglePlayPreview} 
                variant="ghost" 
                size="icon"
                className="h-8 w-8"
                title={isPlaying ? "Pausar" : "Ouvir"}
              >
                {isPlaying ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button 
                onClick={handleRerecord} 
                variant="ghost" 
                size="icon"
                className="h-8 w-8"
                title="Gravar novamente"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button 
                onClick={handleCancel}
                variant="ghost" 
                size="icon"
                className="h-8 w-8"
                title="Cancelar"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button 
                onClick={handleSendAudio} 
                variant="ghost" 
                size="icon"
                className="text-primary hover:text-primary/80 h-8 w-8"
                title="Enviar áudio"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {isPlaying && (
            <div className="h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-primary animate-pulse" style={{ width: "100%" }} />
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

