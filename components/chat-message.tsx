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
  FileVideo,
  Link as LinkIcon,
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
    type: "text" | "image" | "audio" | "file" | "location" | "poll" | "link"
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
    fileSize?: number
    additional_data?: string
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
  const [linkData, setLinkData] = useState<any>(null)

  // Processar dados adicionais para links
  useEffect(() => {
    if (!message) return;
    
    console.log("Processando mensagem:", message.id, "Tipo:", message.type, "Tipo estrito:", typeof message.type, "Igualdade:", message.type === 'link');
    
    // Verificar e garantir que o tipo seja tratado como string
    const messageType = String(message.type).toLowerCase();
    
    if (messageType === 'link' && message.content) {
      try {
        const data = JSON.parse(message.content);
        console.log("Dados do link processados:", data);
        setLinkData(data);
      } catch (error) {
        console.error("Erro ao processar link:", error);
      }
    }
  }, [message]);

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
        console.error("Erro ao carregar áudio:", e.target instanceof HTMLAudioElement ? e.target.error : "Erro desconhecido");
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

  const handleReactionAdd = (emoji: string) => {
    onReactionAdd?.(message.id, emoji)
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
    // Garantir que o tipo seja uma string para comparação segura
    const messageType = String(message.type).toLowerCase();
    
    console.log("Renderizando mensagem ID:", message.id, "Tipo:", messageType, "Conteúdo:", 
      typeof message.content === 'string' && message.content.length > 100 
        ? message.content.substring(0, 100) + '...' 
        : message.content
    );
    
    switch (messageType) {
      case "text":
        return (
          <div
            className="prose prose-sm dark:prose-invert max-w-none mt-1 break-words"
            dangerouslySetInnerHTML={{ __html: processContent(message.content) }}
          />
        )

      case "image":
        return (
          <div className="mt-2">
            <img
              src={message.content}
              alt="Imagem compartilhada"
              className="max-w-full rounded-md cursor-pointer max-h-60 object-contain"
              onClick={() => onFilePreview?.(message)}
            />
          </div>
        )

      case "audio":
        // Função para formatar o tempo no formato 0:SS (exatamente como solicitado)
        const formatTime = (timeInSeconds: number) => {
          // Arredonda para baixo para ter minutos inteiros
          const minutes = Math.floor(timeInSeconds / 60);
          // Arredonda para baixo para ter segundos inteiros
          const seconds = Math.floor(timeInSeconds % 60);
          // Formata como "0:SS" com zero à esquerda para segundos < 10
          return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
        };
        
        return (
          <div className="mt-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-md w-full max-w-[300px]">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {!isOwnMessage ? (
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={message.sender.avatar || "/placeholder.svg?height=36&width=36"} />
                    <AvatarFallback>{message.sender.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                ) : (
                  <button
                    onClick={handlePlayAudio}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                  </button>
                )}
              </div>
              
              {!isOwnMessage && (
                <button
                  onClick={handlePlayAudio}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                </button>
              )}

              <div className="flex-1">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-primary h-2.5 rounded-full"
                    style={{ width: `${audioProgress}%` }}
                  ></div>
                </div>

                <div className="flex justify-between mt-1.5">
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                    {isPlaying 
                      ? formatTime((audioDuration * audioProgress) / 100) 
                      : audioProgress > 0 ? formatTime((audioDuration * audioProgress) / 100) : "0:00"}
                  </span>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                    {audioDuration ? formatTime(audioDuration) : "0:00"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )

      case "file":
        // Verifica se há additional_data com informações extras sobre o arquivo
        let fileSize = message.fileSize;
        if (!fileSize && message.additional_data) {
          try {
            const additionalData = JSON.parse(message.additional_data);
            if (additionalData.fileSize) {
              fileSize = additionalData.fileSize;
            }
          } catch (error) {
            console.error("Erro ao processar additional_data:", error);
          }
        }
        
        return (
          <div className="mt-2">
            <FilePreview 
              fileName={message.fileName || "Arquivo"} 
              fileUrl={message.content}
              fileSize={fileSize}
            />
          </div>
        )

      case "link":
        // Abordagem muito simples: para mensagens do tipo 'link', sempre renderizamos como link
        console.log("[DEBUG] Renderizando mensagem de tipo LINK (forçado)");
        
        try {
          if (!message.content) {
            console.error("[DEBUG] Conteúdo de link vazio");
            return <div>Link inválido (sem conteúdo)</div>;
          }
          
          // Extrair dados do link do conteúdo
          let url = "";
          let title = "Link compartilhado";
          let urls: string[] = [];
          
          try {
            if (typeof message.content === 'string' && (message.content.startsWith('{') || message.content.startsWith('['))) {
              // Tentar parsear como JSON
              const linkData = JSON.parse(message.content);
              url = linkData.url || "";
              title = linkData.title || url || "Link compartilhado";
              
              // Montar lista de URLs
              urls = [url];
              if (linkData.additionalUrls && Array.isArray(linkData.additionalUrls)) {
                urls = [...urls, ...linkData.additionalUrls];
              }
            } else {
              // Se não for JSON, usar o conteúdo diretamente como URL
              url = message.content;
              urls = [url];
            }
          } catch (error) {
            console.error("[DEBUG] Erro ao processar conteúdo do link:", error);
            url = typeof message.content === 'string' ? message.content : "";
            urls = [url];
          }
          
          // Se não temos URL, não temos como mostrar o link
          if (!url) {
            console.error("[DEBUG] URL não encontrada no conteúdo");
            return <div>Link inválido (URL ausente)</div>;
          }
          
          console.log("[DEBUG] Renderizando link com isLink=true:", { url, title, urlCount: urls.length });
          
          // Sempre forçar isLink=true para mensagens do tipo 'link'
          return (
            <div className="mt-2">
              <FilePreview 
                fileName={title}
                fileUrl={url}
                isLink={true} // Forçar isLink=true
                linkUrls={urls}
              />
            </div>
          );
        } catch (error) {
          console.error("[DEBUG] Erro ao processar mensagem de link:", error);
          return <div>Erro ao processar link</div>;
        }

      case "location":
        let location
        try {
          location = typeof message.content === "string" ? JSON.parse(message.content) : message.content
        } catch (error) {
          console.error("Error parsing location data:", error)
          return <div>Localização inválida</div>
        }

        // Montar a URL do Google Maps
        const googleMapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
        // URL para a imagem estática do mapa
        const mapImageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${location.latitude},${location.longitude}&zoom=15&size=600x300&maptype=roadmap&markers=color:red%7C${location.latitude},${location.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}`;
        
        // Formatar o endereço com base nas informações disponíveis
        const formatAddress = (location: any) => {
          if (!location.address) return "Localização compartilhada";
          
          // Se o endereço já estiver formatado como string, exibir como está
          if (typeof location.address === 'string') return location.address;
          
          // Se for um objeto com informações detalhadas
          const address = location.address;
          
          // Exemplo de formato: Rua José Cupertino, 257 - Centro / Monte Alto - SP
          let formattedAddress = "Localização compartilhada\n";
          
          // Rua e número
          if (address.street) {
            formattedAddress += address.street;
            if (address.number) formattedAddress += `, ${address.number}`;
          }
          
          // Bairro
          if (address.neighborhood) {
            formattedAddress += ` - ${address.neighborhood}`;
          }
          
          // Cidade e Estado
          if (address.city || address.state) {
            formattedAddress += " / ";
            if (address.city) formattedAddress += address.city;
            if (address.city && address.state) formattedAddress += " - ";
            if (address.state) formattedAddress += address.state;
          }
          
          return formattedAddress;
        };

        return (
          <div className="mt-2">
            <div
              className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start space-x-2 mb-2">
                <MapPin className="h-5 w-5 text-red-500 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-gray-800 dark:text-gray-300 font-medium">Localização compartilhada</span>
                  {formatAddress(location) !== "Localização compartilhada" && formatAddress(location) !== "Localização compartilhada\n" && (
                    <span className="text-gray-600 dark:text-gray-400 text-sm">
                      {formatAddress(location).replace("Localização compartilhada\n", "")}
                    </span>
                  )}
                </div>
              </div>
              
              <a 
                href={googleMapsUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block rounded-md overflow-hidden hover:opacity-90 transition-opacity"
              >
                {/* Imagem estática do mapa - fallback para quando a API key não estiver disponível */}
                {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                  <div 
                    className="h-36 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center"
                  >
                    <div className="text-center">
                      <MapPin className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Clique para abrir no Google Maps</p>
                    </div>
                  </div>
                ) : (
                  <img 
                    src={mapImageUrl}
                    alt="Mapa da localização"
                    className="w-full h-36 object-cover rounded-md"
                  />
                )}
              </a>
            </div>
          </div>
        )

      case "poll":
        return renderPoll()

      default:
        return <div>{message.content}</div>
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

