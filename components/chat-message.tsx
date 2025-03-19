"use client"

import { useState, useRef, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Play,
  Pause,
  Download,
  FileText,
  MoreVertical,
  Reply,
  Copy,
  Trash2,
  Check,
  Pin,
  Quote,
  MapPin,
  ThumbsUp,
  FileImage,
  FileArchive,
  FileCode,
  File,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import MessageReactions from "./message-reactions"
import { marked } from "marked"
import DOMPurify from "dompurify"
import FilePreview from "./file-preview"

interface ChatMessageProps {
  message: {
    id: string
    chatId: string
    sender: {
      id: string
      name: string
      avatar?: string
    }
    content: string
    timestamp: string
    type: "text" | "image" | "audio" | "file" | "location" | "poll"
    replyTo?: {
      id: string
      content: string
      sender: {
        name: string
      }
    }
    reactions?: {
      emoji: string
      count: number
      users: string[]
    }[]
    mentions?: string[]
    isPinned?: boolean
    location?: {
      latitude: number
      longitude: number
      address?: string
    }
    poll?: {
      question: string
      options: {
        id: string
        text: string
        votes: number
      }[]
      totalVotes: number
      hasVoted?: boolean
    }
    fileName?: string
  }
  isOwnMessage: boolean
  currentUserId: string
  participants: any[]
  onReply?: (messageId: string) => void
  onDelete?: (messageId: string) => void
  onPin?: (messageId: string, isPinned: boolean) => void
  onQuote?: (messageId: string) => void
  onReactionAdd?: (messageId: string, emoji: string) => void
  onVote?: (messageId: string, optionId: string) => void
  onFilePreview?: (file: any) => void
  onTranslate?: (messageId: string) => void
  pinnedMessages?: any[]
}

export default function ChatMessage({
  message,
  isOwnMessage,
  currentUserId,
  participants,
  onReply,
  onDelete,
  onPin,
  onQuote,
  onReactionAdd,
  onVote,
  onFilePreview,
  onTranslate,
  pinnedMessages,
}: ChatMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [copied, setCopied] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Process markdown and mentions
  const processContent = (content: string) => {
    // First, escape HTML to prevent XSS
    let processedContent = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")

    // Process mentions
    processedContent = processedContent.replace(/@(\w+)/g, (match, username) => {
      // Verificar se a lista de participantes existe antes de tentar encontrar
      if (participants && Array.isArray(participants)) {
        const mentionedUser = participants.find((p) => p.name?.toLowerCase() === username.toLowerCase())

        if (mentionedUser) {
          return `<span class="bg-primary/20 text-primary font-medium rounded px-1">@${username}</span>`
        }
      }

      return match
    })

    // Process markdown
    if (message.type === "text") {
      try {
        // Convert markdown to HTML (simplificado para evitar problemas de tipagem)
        const htmlContent = marked.parse(processedContent) as string;

        // Sanitize HTML
        processedContent = DOMPurify.sanitize(htmlContent)
      } catch (error) {
        console.error("Error processing markdown:", error)
      }
    }

    return processedContent
  }

  // Criar elemento de áudio se for uma mensagem de áudio
  useEffect(() => {
    if (message.type === "audio" && !audioElement) {
      console.log("Criando elemento de áudio para:", message.content);
      const audio = new Audio(message.content);
      
      audio.addEventListener("timeupdate", () => {
        if (audio.duration) {
          setAudioProgress((audio.currentTime / audio.duration) * 100);
        }
      });
      
      audio.addEventListener("loadedmetadata", () => {
        setAudioDuration(audio.duration);
      });
      
      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setAudioProgress(0);
        audio.currentTime = 0;
      });
      
      audio.addEventListener("error", (e) => {
        console.error("Erro ao carregar áudio:", e);
        setIsPlaying(false);
      });
      
      setAudioElement(audio);
      audioRef.current = audio;
    }
    
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = "";
        setAudioElement(null);
      }
    };
  }, [message.type, message.content, audioElement]);

  const handlePlayAudio = () => {
    if (!audioElement) {
      console.log("Elemento de áudio não disponível");
      // Tentar criar o elemento se não existir
      if (message.type === "audio") {
        const audio = new Audio(message.content);
        setAudioElement(audio);
        audioRef.current = audio;
        
        // Adicionar eventos
        audio.addEventListener("ended", () => {
          setIsPlaying(false);
        });
        
        audio.addEventListener("timeupdate", () => {
          if (audio.duration) {
            setAudioProgress((audio.currentTime / audio.duration) * 100);
          }
        });
        
        // Reproduzir após criação
        audio.play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch(err => {
            console.error("Erro ao reproduzir áudio:", err);
            setIsPlaying(false);
          });
      }
      return;
    }
    
    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      audioElement.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(err => {
          console.error("Erro ao reproduzir áudio:", err);
          setIsPlaying(false);
        });
    }
  }

  const handleCopyText = () => {
    if (message.type === "text") {
      navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleReactionAdd = (messageId: string, emoji: string) => {
    if (onReactionAdd) {
      onReactionAdd(messageId, emoji)
    }
  }

  const handleVote = (optionId: string) => {
    if (onVote && message.poll && !message.poll.hasVoted) {
      onVote(message.id, optionId)
    }
  }

  const handleTranslate = () => {
    if (onTranslate) {
      onTranslate(message.id)
    }
  }

  const handleFilePreview = (file: any) => {
    if (onFilePreview) {
      onFilePreview(file)
    }
  }

  // Initialize map when location message is shown
  useEffect(() => {
    if (message.type === "location" && message.location && showMap && mapRef.current) {
      // This would normally use a mapping library like Leaflet or Google Maps
      // For this example, we'll just show a placeholder
      const mapElement = mapRef.current
      mapElement.innerHTML = `
        <div class="bg-gray-200 dark:bg-gray-700 rounded-md p-4 text-center">
          <p>Mapa em ${message.location.latitude}, ${message.location.longitude}</p>
          ${message.location.address ? `<p>${message.location.address}</p>` : ""}
        </div>
      `
    }
  }, [showMap, message])

  const renderReplyPreview = () => {
    if (!message.replyTo) return null

    return (
      <div className="mb-1 p-1.5 border-l-2 border-primary/50 bg-muted/50 rounded text-xs">
        <p className="font-medium">{message.replyTo.sender.name}</p>
        <p className="truncate">
          {message.replyTo.content.length > 50
            ? message.replyTo.content.substring(0, 50) + "..."
            : message.replyTo.content}
        </p>
      </div>
    )
  }

  const renderPoll = () => {
    if (!message.poll) return null

    const { question, options, totalVotes, hasVoted } = message.poll

    return (
      <div className="mt-2 space-y-2">
        <p className="font-medium">{question}</p>
        <div className="space-y-2">
          {options.map((option) => {
            const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0

            return (
              <div key={option.id} className="space-y-1">
                <div
                  className={cn(
                    "flex items-center p-2 rounded-md cursor-pointer",
                    hasVoted ? "bg-muted" : "hover:bg-muted/50",
                  )}
                  onClick={() => handleVote(option.id)}
                >
                  <div className="flex-1">
                    <p className="text-sm">{option.text}</p>
                  </div>
                  {hasVoted && (
                    <div className="text-xs font-medium">
                      {percentage}% ({option.votes})
                    </div>
                  )}
                </div>
                {hasVoted && (
                  <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${percentage}%` }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-500">
          {totalVotes} {totalVotes === 1 ? "voto" : "votos"}
        </p>
      </div>
    )
  }

  const renderMessageContent = () => {
    switch (message.type) {
      case "text":
        return (
          <div
            className="text-sm whitespace-pre-wrap break-words prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: processContent(message.content) }}
          />
        )

      case "image":
        return (
          <div className="mt-2">
            <img
              src={message.content || "/placeholder.svg"}
              alt="Shared image"
              className="max-w-xs rounded-md"
              onClick={() => window.open(message.content, "_blank")}
            />
          </div>
        )

      case "audio":
        // Formatar duração
        const formatTime = (seconds: number) => {
          const minutes = Math.floor(seconds / 60);
          const secs = Math.floor(seconds % 60);
          return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
        };
        
        // Função para baixar o áudio
        const downloadAudio = async () => {
          try {
            const response = await fetch(message.content);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = message.fileName || 'audio.mp3';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          } catch (error) {
            console.error('Erro ao baixar áudio:', error);
          }
        };
        
        return (
          <div className="flex flex-col mt-1 w-full max-w-[300px]">
            <div className="flex items-center space-x-3">
              <Button 
                size="icon" 
                onClick={handlePlayAudio}
                className="h-10 w-10 flex-shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 border-none shadow-sm"
                variant="default"
              >
                {isPlaying ? 
                  <Pause className="h-5 w-5" /> : 
                  <Play className="h-5 w-5 ml-0.5" />
                }
              </Button>
              
              <div className="flex-1 min-h-[46px] bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium">
                    {isOwnMessage ? "Seu áudio" : "Mensagem de áudio"}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {audioDuration ? formatTime(audioDuration) : "--:--"}
                  </span>
                </div>
                
                {/* Barra de progresso com melhor visual */}
                <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300" 
                    style={{ width: `${audioProgress}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Elemento de áudio invisível para carregar os metadados */}
            <audio 
              ref={audioRef}
              src={message.content} 
              className="hidden"
              preload="metadata"
            />
          </div>
        )

      case "file":
        const fileName = message.fileName || message.content.split("/").pop() || "Arquivo";
        return (
          <div className="mt-2">
            <FilePreview fileName={fileName} fileUrl={message.content} />
          </div>
        )

      case "location":
        try {
          const locationData = typeof message.content === "string" ? JSON.parse(message.content) : message.content
          return (
            <div className="mt-2">
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <MapPin className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium">Localização Compartilhada</span>
                </div>
                {locationData.address && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{locationData.address}</p>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`,
                      "_blank"
                    )
                  }
                >
                  Abrir no Maps
                </Button>
              </div>
            </div>
          )
        } catch (error) {
          console.error("Error parsing location data:", error)
          return <div className="text-red-500">Erro ao carregar localização</div>
        }

      case "poll":
        return renderPoll()

      default:
        return <div className="text-sm">{message.content}</div>
    }
  }

  return (
    <div
      id={`message-${message.id}`}
      className={cn(
        "flex items-start space-x-3 transition-colors duration-300 group mb-4",
        isOwnMessage ? "flex-row-reverse space-x-reverse" : "flex-row",
        message.isPinned && "bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-lg",
      )}
    >
      {!isOwnMessage && (
        <Avatar className="h-10 w-10 mt-1">
          <AvatarImage src={message.sender.avatar || "/placeholder.svg?height=40&width=40"} />
          <AvatarFallback>{message.sender.name.charAt(0)}</AvatarFallback>
        </Avatar>
      )}

      <div className={cn("max-w-md", isOwnMessage ? "items-end" : "items-start")}>
        {message.isPinned && (
          <div className="flex items-center text-xs text-yellow-600 dark:text-yellow-400 mb-1">
            <Pin className="h-3 w-3 mr-1" />
            Mensagem fixada
          </div>
        )}

        <div className="relative">
          <Card className={cn("p-3", isOwnMessage ? "bg-primary text-primary-foreground" : "bg-muted")}>
            {!isOwnMessage && <p className="text-xs font-medium mb-1">{message.sender.name}</p>}

            {renderReplyPreview()}
            {renderMessageContent()}
          </Card>

          <div
            className={cn(
              "absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity",
              isOwnMessage ? "left-0 -translate-x-full pl-2" : "right-0 translate-x-full pr-2",
            )}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwnMessage ? "start" : "end"}>
                {onReply && (
                  <DropdownMenuItem onClick={() => onReply(message.id)}>
                    <Reply className="h-4 w-4 mr-2" />
                    Responder
                  </DropdownMenuItem>
                )}

                {onQuote && (
                  <DropdownMenuItem onClick={() => onQuote(message.id)}>
                    <Quote className="h-4 w-4 mr-2" />
                    Citar
                  </DropdownMenuItem>
                )}

                {message.type === "text" && onTranslate && (
                  <DropdownMenuItem onClick={handleTranslate}>
                    <MapPin className="h-4 w-4 mr-2" />
                    Traduzir
                  </DropdownMenuItem>
                )}

                {(message.type === "file" || message.type === "image") && onFilePreview && (
                  <DropdownMenuItem onClick={() => handleFilePreview(message)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Visualizar
                  </DropdownMenuItem>
                )}

                {message.type === "audio" && (
                  <DropdownMenuItem onClick={async () => {
                    try {
                      const response = await fetch(message.content);
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.style.display = 'none';
                      a.href = url;
                      a.download = message.fileName || 'audio.mp3';
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    } catch (error) {
                      console.error('Erro ao baixar áudio:', error);
                    }
                  }}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar áudio
                  </DropdownMenuItem>
                )}

                {message.type === "text" && (
                  <DropdownMenuItem onClick={handleCopyText}>
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar texto
                      </>
                    )}
                  </DropdownMenuItem>
                )}

                {onPin && (
                  <DropdownMenuItem onClick={() => onPin(message.id, !message.isPinned)}>
                    <Pin className="h-4 w-4 mr-2" />
                    {message.isPinned ? "Desafixar" : "Fixar mensagem"}
                  </DropdownMenuItem>
                )}

                {message.type === "poll" && message.poll && !message.poll.hasVoted && (
                  <DropdownMenuItem onClick={() => {}}>
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    Votar
                  </DropdownMenuItem>
                )}

                {isOwnMessage && onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(message.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-gray-500">{format(new Date(message.timestamp), "HH:mm")}</p>

          {message.reactions && message.reactions.length > 0 && (
            <MessageReactions
              messageId={message.id}
              chatId={message.chatId}
              userId={currentUserId}
              existingReactions={message.reactions}
              onReactionAdd={handleReactionAdd}
            />
          )}
        </div>
      </div>
    </div>
  )
}

