"use client"

import { useState, useEffect, useRef, useLayoutEffect } from "react"
import { useRouter } from "next/navigation"
import { io, type Socket } from "socket.io-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Search,
  Trash2,
  Bell,
  Users,
  LogOut,
  Settings,
  BellOff,
  Database,
  BarChart2,
  MapPin,
  History,
  Pin,
  Filter,
  Archive,
  TagIcon,
  MoreVertical,
  X,
  MessageSquare,
  User,
  Tag,
  UserPlus,
  Download,
  Menu,
  ChevronLeft,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import ChatMessage from "@/components/chat-message"
import AudioRecorder from "@/components/audio-recorder"
import FileUpload from "@/components/file-upload"
import SearchMessages from "@/components/search-messages"
import CreateGroup from "@/components/create-group"
import ProfileEditor from "@/components/profile-editor"
import GroupSettings from "@/components/group-settings"
import MessageInput from "@/components/message-input"
import BackupManager from "@/components/backup-manager"
import MessageTranslator from "@/components/message-translator"
import PollCreator from "@/components/poll-creator"
import ActionHistory from "@/components/action-history"
import ChatFilter from "@/components/chat-filter"
import TagManager from "@/components/tag-manager"
import { cn, isLightColor } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import UserList from "@/components/user-list"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import CreatePoll from "@/components/create-poll"
import FilePreview from "@/components/file-preview"

interface User {
  id: string
  name: string
  email: string
  avatar?: string
  is_online: boolean
  last_seen?: string
}

interface Reaction {
  emoji: string
  count: number
  users: string[]
}

interface Message {
  id: string
  content: string
  type: string
  reactions?: Reaction[]
}

interface ChatParticipant extends User {
  isAdmin: boolean
}

interface Chat {
  id: number
  name: string | null
  avatar: string | null
  is_group: boolean
  created_at: string
  updated_at: string
  participants: ChatParticipant[]
  lastMessage?: {
    content: string
    timestamp: string
  }
}

export default function ChatApp() {
  const { toast } = useToast()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [activeChat, setActiveChat] = useState<any>(null)
  const [chats, setChats] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [socket, setSocket] = useState<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const notificationSound = useRef<HTMLAudioElement>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [replyingTo, setReplyingTo] = useState<any>(null)
  const [reactingTo, setReactingTo] = useState<any>(null)
  const [quotePreview, setQuotePreview] = useState<any>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isEditingGroup, setIsEditingGroup] = useState(false)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [isManagingBackup, setIsManagingBackup] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [messageToTranslate, setMessageToTranslate] = useState<any>(null)
  const [isCreatingPoll, setIsCreatingPoll] = useState(false)
  const [isViewingHistory, setIsViewingHistory] = useState(false)
  const [isSchedulingMessage, setIsSchedulingMessage] = useState(false)
  const [scheduledMessage, setScheduledMessage] = useState<any>({ content: "", date: null })
  const [userList, setUserList] = useState<User[]>([])
  const [isSharingLocation, setIsSharingLocation] = useState(false)
  const [location, setLocation] = useState<any>(null)
  const [attachmentType, setAttachmentType] = useState<"file" | "audio" | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("chats")
  const [tags, setTags] = useState<any[]>([])
  const [activeFilters, setActiveFilters] = useState({ tags: [], query: "", showArchived: false })
  const [filteredChats, setFilteredChats] = useState<any[]>([])
  const [isFilteringChats, setIsFilteringChats] = useState(false)
  const [isManagingTags, setIsManagingTags] = useState(false)
  const [selectedFile, setSelectedFile] = useState<any>(null)
  const [isPreviewingFile, setIsPreviewingFile] = useState(false)
  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' && window.innerWidth > 768)
  // Adicionar estados para mutedChats e pinnedMessages
  const [mutedChats, setMutedChats] = useState<string[]>([])
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([])
  const [archivedChats, setArchivedChats] = useState<any[]>([])
  const messageInputRef = useRef<HTMLInputElement>(null)
  
  // Detect mobile on initial load
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setSidebarOpen(false)
      } else {
        setSidebarOpen(true)
      }
    }
    
    // Set initial state
    handleResize()
    
    // Add resize listener
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useLayoutEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem("chatUser")
    if (!storedUser) {
      router.push("/login")
      return
    }

    setUser(JSON.parse(storedUser))

    // Load muted chats from localStorage
    const storedMutedChats = localStorage.getItem("mutedChats")
    if (storedMutedChats) {
      setMutedChats(JSON.parse(storedMutedChats))
    }
  }, [router])

  useEffect(() => {
    if (!user) return

    // Fetch tags when user is loaded
    fetchTags()

    // Initialize socket connection
    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001", {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })
    
    setSocket(socketInstance)

    // Cleanup function
    return () => {
      console.log("Desconectando socket")
      if (socketInstance) {
        socketInstance.disconnect()
      }
    }
  }, [user])

  useEffect(() => {
    if (!socket || !user) return

    const handleNewMessage = (newMessage: any) => {
      console.log("Nova mensagem recebida:", newMessage)
      
      setMessages(prev => {
        // Verifica se a mensagem já existe para evitar duplicatas
        const messageExists = prev.some(msg => msg.id === newMessage.id)
        if (messageExists) {
          return prev
        }
        return [...prev, newMessage]
      })

      // Atualiza a lista de chats
      setChats(prevChats => {
        const updatedChats = prevChats.map(chat => {
          if (String(chat.id) === String(newMessage.chatId)) {
            return {
              ...chat,
              lastMessage: {
                content: newMessage.content,
                timestamp: newMessage.timestamp
              },
              updated_at: new Date().toISOString()
            }
          }
          return chat
        })
        
        return updatedChats.sort((a, b) => {
          const aTime = a.updated_at || a.created_at
          const bTime = b.updated_at || b.created_at
          return new Date(bTime).getTime() - new Date(aTime).getTime()
        })
      })

      // Notifica se não estiver no chat ativo
      if (String(newMessage.chatId) !== String(activeChat?.id) && !mutedChats.includes(String(newMessage.chatId))) {
        if (notificationSound.current) {
          notificationSound.current.play()
        }

        const isMentioned = newMessage.content.includes(`@${user?.name}`)
        toast({
          title: isMentioned ? "🔔 Você foi mencionado!" : "Nova Mensagem",
          description: `${newMessage.sender.name}: ${newMessage.content.substring(0, 30)}${newMessage.content.length > 30 ? "..." : ""}`,
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const chat = chats.find((c) => String(c.id) === String(newMessage.chatId))
                if (chat) {
                  setActiveChat(chat)
                  setActiveTab(chat.is_group ? "groups" : "chats")
                }
              }}
            >
              Ver
            </Button>
          ),
        })
      }
    }

    socket.on("connect", () => {
      console.log("Conectado ao servidor de socket")
      socket.emit("user:login", user)
    })

    socket.on("message:new", handleNewMessage)
    socket.on("message:history", (messageHistory) => {
      console.log("Histórico de mensagens recebido:", messageHistory)
      setMessages(messageHistory)
    })

    socket.on("chat:list", (chatList) => {
      console.log("Lista de chats recebida:", chatList)
      setChats(chatList)
    })

    socket.on("chat:new", (newChat) => {
      console.log("Novo chat recebido:", newChat)
      
      // Adiciona o novo chat à lista se não existir
      setChats((prevChats) => {
        // Verificação mais rigorosa para evitar duplicação
        const chatExists = prevChats.some((c) => {
          // Se for grupo, verificar pelo ID exato
          if (newChat.is_group) {
            return Number(c.id) === Number(newChat.id);
          }
          
          // Se for chat individual, verificar pelos participantes também
          if (!c.is_group && !newChat.is_group) {
            // Verificar se os participantes são os mesmos
            const newChatParticipantIds = newChat.participants.map((p: any) => String(p.id)).sort();
            const existingChatParticipantIds = c.participants.map((p: any) => String(p.id)).sort();
            
            // Comparar os arrays de IDs
            return (
              JSON.stringify(newChatParticipantIds) === JSON.stringify(existingChatParticipantIds)
            );
          }
          
          return Number(c.id) === Number(newChat.id);
        });
        
        if (chatExists) {
          console.log("Chat já existe, não adicionando duplicata");
          return prevChats;
        }
        
        console.log("Adicionando novo chat:", newChat.id, newChat);
        
        // Define a aba ativa com base no tipo de chat
        if (newChat.is_group) {
          setActiveTab("groups");
        } else {
          setActiveTab("chats");
        }
        
        // Ativa o novo chat
        setActiveChat(newChat);
        
        // Entra no canal de socket do chat (usando optional chaining)
        socket?.emit("chat:join", String(newChat.id));
        
        // Retorna a lista atualizada
        return [...prevChats, newChat];
      });
    })

    socket.on("chat:updated", (updatedChat) => {
      setChats((prev) => prev.map((chat) => (chat.id === updatedChat.id ? updatedChat : chat)))

      if (activeChat?.id === updatedChat.id) {
        setActiveChat(updatedChat)
      }
    })

    socket.on("message:reaction", ({ messageId, userId, emoji }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            const existingReactions = msg.reactions || []
            const existingReaction = existingReactions.find((r: Reaction) => r.emoji === emoji)

            let updatedReactions

            if (existingReaction) {
              // Check if user already reacted
              if (existingReaction.users.includes(userId)) {
                // Remove user's reaction
                updatedReactions = existingReactions
                  .map((r: Reaction) => {
                    if (r.emoji === emoji) {
                      return {
                        ...r,
                        count: r.count - 1,
                        users: r.users.filter((id: string) => id !== userId),
                      }
                    }
                    return r
                  })
                  .filter((r: Reaction) => r.count > 0)
              } else {
                // Add user's reaction
                updatedReactions = existingReactions.map((r: Reaction) => {
                  if (r.emoji === emoji) {
                    return {
                      ...r,
                      count: r.count + 1,
                      users: [...r.users, userId],
                    }
                  }
                  return r
                })
              }
            } else {
              // Create new reaction
              updatedReactions = [
                ...existingReactions,
                {
                  emoji,
                  count: 1,
                  users: [userId],
                },
              ]
            }

            return {
              ...msg,
              reactions: updatedReactions,
            }
          }
          return msg
        })
      )
    })

    socket.on("message:pinned", ({ messageId, isPinned }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            return {
              ...msg,
              isPinned,
            }
          }
          return msg
        }),
      )

      // Update pinned messages list
      if (isPinned) {
        const pinnedMessage = messages.find((m) => m.id === messageId)
        if (pinnedMessage) {
          setPinnedMessages((prev) => [...prev, pinnedMessage])
        }
      } else {
        setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId))
      }
    })

    socket.on("poll:vote", ({ pollId, results }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.type === "poll" && msg.poll && msg.poll.id === pollId) {
            return {
              ...msg,
              poll: {
                ...msg.poll,
                options: results.options,
                totalVotes: results.totalVotes,
                hasVoted: true,
              },
            }
          }
          return msg
        }),
      )
    })

    return () => {
      socket.off("connect")
      socket.off("message:new")
      socket.off("message:history")
      socket.off("chat:list")
    }
  }, [socket, user, activeChat?.id, mutedChats])

  useEffect(() => {
    // Load messages when active chat changes
    if (activeChat && socket) {
      console.log(`Entrando no chat: ${activeChat.id}`)
      socket.emit("chat:join", String(activeChat.id))
      socket.emit("message:history", String(activeChat.id))

      // Get pinned messages if available
      if (activeChat.pinned_messages) {
        setPinnedMessages(activeChat.pinned_messages)
      } else {
        setPinnedMessages([])
      }
    }
  }, [activeChat, socket])

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Save muted chats to localStorage when changed
  useEffect(() => {
    localStorage.setItem("mutedChats", JSON.stringify(mutedChats))
  }, [mutedChats])

  useEffect(() => {
    // Fetch tags when user is loaded
    if (user) {
      fetchTags()
    }
  }, [user])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const fetchTags = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tags`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setTags(data)
      }
    } catch (error) {
      console.error("Error fetching tags:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao carregar as tags",
        variant: "destructive",
      })
    }
  }

  const handleTagCreate = async (tagData: any) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          ...tagData,
          userId: user.id
        }),
      })

      if (!response.ok) {
        throw new Error("Falha ao criar tag")
      }

      const data = await response.json()
      setTags(prev => [...prev, data])
      
      toast({
        title: "Sucesso",
        description: "Tag criada com sucesso",
      })
    } catch (error) {
      console.error("Error creating tag:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao criar a tag",
        variant: "destructive",
      })
    }
  }

  const handleTagAssign = async (chatId: string, tagIds: string[]) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chats/${chatId}/tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ tagIds }),
      })

      if (!response.ok) {
        throw new Error("Falha ao atribuir tags")
      }

      // Atualiza o chat na lista
      const data = await response.json()
      setChats(prev => prev.map(chat => 
        chat.id === chatId ? { ...chat, tags: data.tags } : chat
      ))

      toast({
        title: "Sucesso",
        description: "Tags atribuídas com sucesso",
      })
    } catch (error) {
      console.error("Error assigning tags:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao atribuir as tags",
        variant: "destructive",
      })
    }
  }

  const handleTagUpdate = async (tagId: string, tagData: any) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tags/${tagId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(tagData),
      })

      if (!response.ok) {
        throw new Error("Falha ao atualizar tag")
      }

      fetchTags()
      toast({
        title: "Sucesso",
        description: "Tag atualizada com sucesso",
      })
    } catch (error) {
      console.error("Error updating tag:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao atualizar a tag",
        variant: "destructive",
      })
    }
  }

  const handleTagDelete = async (tagId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tags/${tagId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })

      if (!response.ok) {
        throw new Error("Falha ao excluir tag")
      }

      fetchTags()
      toast({
        title: "Sucesso",
        description: "Tag excluída com sucesso",
      })
    } catch (error) {
      console.error("Error deleting tag:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao excluir a tag",
        variant: "destructive",
      })
    }
  }

  const applyFilters = (filters: any) => {
    setActiveFilters(filters)

    let filtered = [...chats]

    // Filter by tags
    if (filters.tags.length > 0) {
      filtered = filtered.filter((chat) => {
        // Check if chat has any of the selected tags
        return chat.tags && chat.tags.some((tag: any) => filters.tags.includes(tag.id))
      })
    }

    // Filter by search query
    if (filters.query) {
      const query = filters.query.toLowerCase()
      filtered = filtered.filter((chat) => {
        const chatName = chat.is_group ? chat.name : chat.participants[0]?.name
        return (
          chatName.toLowerCase().includes(query) ||
          (chat.lastMessage && chat.lastMessage.content.toLowerCase().includes(query))
        )
      })
    }

    // Include archived chats if requested
    if (filters.showArchived) {
      filtered = [...filtered, ...archivedChats]
    } else {
      // Exclude archived chats
      filtered = filtered.filter((chat) => !chat.isArchived)
    }

    setFilteredChats(filtered)
  }

  const handleSendMessage = (content: string) => {
    if (!content.trim() && !isUploading) return

    if (socket && activeChat) {
      const newMessage = {
        chatId: String(activeChat.id),
        sender: {
          id: String(user?.id),
          name: user?.name, 
          avatar: user?.avatar
        },
        content,
        timestamp: new Date().toISOString(),
        type: "text",
        replyTo: replyingTo,
        quotedMessage: quotePreview,
      }

      console.log("Enviando mensagem:", newMessage); // Depuração
      
      socket.emit("message:send", newMessage)
      setInputMessage("")
      setReplyingTo(null)
      setQuotePreview(null)
    }
  }

  const handleScheduleMessage = () => {
    if (!scheduledMessage.content.trim() || !scheduledMessage.date) {
      toast({
        title: "Erro",
        description: "Por favor, preencha a mensagem e selecione uma data",
        variant: "destructive",
      })
      return
    }

    if (scheduledMessage.date < new Date()) {
      toast({
        title: "Erro",
        description: "A data selecionada já passou",
        variant: "destructive",
      })
      return
    }

    if (socket && activeChat) {
      socket.emit("message:schedule", {
        chatId: activeChat.id,
        senderId: user.id,
        content: scheduledMessage.content,
        scheduledFor: scheduledMessage.date.toISOString(),
      })

      toast({
        title: "Mensagem agendada",
        description: `Sua mensagem será enviada em ${scheduledMessage.date.toLocaleString()}`,
      })

      setScheduledMessage({
        content: "",
        date: null,
      })

      setIsSchedulingMessage(false)
    }
  }

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Não suportado",
        description: "Seu navegador não suporta geolocalização",
        variant: "destructive",
      })
      return
    }

    setIsSharingLocation(true)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords

        // Reverse geocoding to get address (would use a service like Google Maps in production)
        const address = "Localização compartilhada"

        setLocation({
          latitude,
          longitude,
          address,
        })
      },
      (error) => {
        console.error("Error getting location:", error)
        toast({
          title: "Erro",
          description: "Não foi possível obter sua localização",
          variant: "destructive",
        })
        setIsSharingLocation(false)
      },
    )
  }

  const handleSendLocation = () => {
    if (!location || !socket || !activeChat) return

    const locationMessage = {
      chatId: activeChat.id,
      sender: user,
      content: JSON.stringify(location),
      timestamp: new Date().toISOString(),
      type: "location",
    }

    socket.emit("message:send", locationMessage)
    setIsSharingLocation(false)
    setLocation(null)
  }

  const handleCreatePoll = async (pollData: any) => {
    if (!socket || !activeChat) {
      toast({
        title: "Erro",
        description: "Não foi possível criar a enquete. Tente novamente.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/messages/poll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          chatId: String(activeChat.id),
          senderId: String(user.id),
          question: pollData.question,
          options: pollData.options,
        }),
      })

      if (!response.ok) {
        throw new Error("Falha ao criar enquete")
      }

      const data = await response.json()
      
      socket.emit("message:send", {
        chatId: String(activeChat.id),
        sender: user,
        content: JSON.stringify({
          question: pollData.question,
          options: pollData.options,
          pollId: data.pollId,
          votes: {},
          totalVotes: 0,
        }),
        timestamp: new Date().toISOString(),
        type: "poll",
      })

      setIsCreatingPoll(false)
      
      toast({
        title: "Enquete criada",
        description: "A enquete foi criada com sucesso!"
      })
    } catch (error) {
      console.error("Error creating poll:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao criar a enquete",
        variant: "destructive",
      })
    }
  }

  const handleVotePoll = (messageId: string, optionId: string) => {
    if (!socket || !activeChat) return

    socket.emit("poll:vote", {
      messageId,
      pollId: messages.find((m) => m.id === messageId)?.poll?.id,
      optionId,
      userId: user.id,
      chatId: activeChat.id,
    })
  }

  const handleChatSelect = (chat: any) => {
    setActiveChat(chat)
    
    // Definir a aba ativa com base no tipo de chat
    if (chat.is_group) {
      setActiveTab("groups")
    } else {
      setActiveTab("chats")
    }
    
    // Juntar o canal do chat e solicitar o histórico de mensagens
    if (socket) {
      socket.emit("chat:join", String(chat.id))
      socket.emit("message:history", String(chat.id))
    }
    
    // Fechar a gaveta em dispositivos móveis
    if (window.innerWidth <= 768) {
      setSidebarOpen(false)
    }
    
    setReplyingTo(null)
    setQuotePreview(null)
  }

  const handleDeleteChat = (chatId: string) => {
    if (socket) {
      socket.emit("chat:delete", chatId)
      if (activeChat?.id === chatId) {
        setActiveChat(null)
        setMessages([])
      }
    }
  }

  const handleDeleteMessage = (messageId: string) => {
    if (socket && activeChat) {
      socket.emit("message:delete", {
        messageId,
        chatId: activeChat.id,
      })

      // Optimistically update UI
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId))

      // If message was pinned, remove from pinned messages
      setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId))
    }
  }

  const handleReplyMessage = (messageId: string) => {
    const messageToReply = messages.find((msg) => msg.id === messageId)
    if (messageToReply) {
      setReplyingTo({
        id: messageId,
        content: messageToReply.content,
        sender: {
          name: messageToReply.sender.name,
        },
      })

      // Focus on message input
      messageInputRef.current?.focus()
    }
  }

  const handleQuoteMessage = (messageId: string) => {
    const messageToQuote = messages.find((msg) => msg.id === messageId)
    if (messageToQuote) {
      setQuotePreview({
        id: messageId,
        content: messageToQuote.content,
        sender: {
          name: messageToQuote.sender.name,
        },
      })

      // Focus on message input
      messageInputRef.current?.focus()
    }
  }

  const handlePinMessage = (messageId: string, isPinned: boolean) => {
    if (socket && activeChat) {
      socket.emit("message:pin", {
        messageId,
        chatId: activeChat.id,
        pin: isPinned,
      })
    }
  }

  const handleReactionAdd = (messageId: string, emoji: string) => {
    if (socket && activeChat) {
      socket.emit("message:reaction", {
        messageId: String(messageId),
        chatId: String(activeChat.id),
        userId: String(user?.id),
        emoji,
      })
    }
  }

  const handleTranslateMessage = (messageId: string) => {
    const messageToTranslate = messages.find((msg) => msg.id === messageId)
    if (messageToTranslate) {
      setMessageToTranslate(messageToTranslate)
      setIsTranslating(true)
    }
  }

  const handleToggleMute = (chatId: string | number) => {
    console.log("Alternando mudo para chat:", chatId)
    const chatIdStr = String(chatId)
    
    setMutedChats((prev) => {
      const newMutedChats = prev.includes(chatIdStr)
        ? prev.filter((id) => id !== chatIdStr)
        : [...prev, chatIdStr]
      
      // Salva no localStorage
      localStorage.setItem("mutedChats", JSON.stringify(newMutedChats))
      
      // Mostra toast de confirmação
      toast({
        title: prev.includes(chatIdStr) ? "Notificações ativadas" : "Notificações silenciadas",
        description: prev.includes(chatIdStr)
          ? "Você receberá notificações para este chat"
          : "Você não receberá notificações para este chat",
      })
      
      return newMutedChats
    })
  }

  const handleLogout = () => {
    if (socket) {
      socket.disconnect()
    }
    localStorage.removeItem("chatUser")
    localStorage.removeItem("token")
    router.push("/login")
  }

  const handleProfileUpdate = (updatedUser: any) => {
    setUser(updatedUser)
    setIsEditingProfile(false)

    // Update user status in socket
    if (socket) {
      socket.emit("user:update", updatedUser)
    }
  }

  const handleGroupUpdate = (updatedGroup: any) => {
    setChats((prev) => prev.map((chat) => (chat.id === updatedGroup.id ? updatedGroup : chat)))

    if (activeChat?.id === updatedGroup.id) {
      setActiveChat(updatedGroup)
    }

    setIsEditingGroup(false)

    // Notify other users about group update
    if (socket) {
      socket.emit("chat:update", updatedGroup)
    }
  }

  // Check if user is admin in current chat
  useEffect(() => {
    if (activeChat?.participants) {
      const checkIsAdmin = activeChat.participants.some(
        (p: ChatParticipant) => p.id === user?.id && p.isAdmin
      );
      setIsAdmin(checkIsAdmin);
    } else {
      setIsAdmin(false);
    }
  }, [activeChat, user?.id]);

  const handleUserSelect = async (selectedUser: User) => {
    // Verifica se já existe um chat individual com este usuário
    const existingChat = chats.find((chat) => {
      if (chat.is_group) return false
      return chat.participants.some((p: ChatParticipant) => String(p.id) === String(selectedUser.id))
    })

    if (existingChat) {
      console.log("Chat existente encontrado:", existingChat)
      handleChatSelect(existingChat)
      return
    }

    // Se não existe, cria um novo chat individual
    if (socket && user) {
      console.log("Criando novo chat com usuário:", selectedUser)
      socket.emit("chat:create", {
        isGroup: false,
        participants: [user.id, selectedUser.id],
        createdBy: user.id
      })
      
      // Fechar a gaveta em dispositivos móveis
      if (window.innerWidth <= 768) {
        setSidebarOpen(false)
      }
    }
  }

  const handleCreateGroup = (groupData: any) => {
    if (!socket || !user) {
      toast({
        title: "Erro",
        description: "Não foi possível criar o grupo. Tente novamente.",
        variant: "destructive",
      })
      return
    }

    try {
      console.log("Tentando criar grupo:", groupData);
      
      // Verificar se temos o nome do grupo
      if (!groupData.name?.trim()) {
        toast({
          title: "Erro",
          description: "O nome do grupo é obrigatório",
          variant: "destructive",
        });
        return;
      }
      
      // Verificar se temos participantes
      if (!groupData.participants?.length) {
        toast({
          title: "Erro",
          description: "Selecione pelo menos um participante para o grupo",
          variant: "destructive",
        });
        return;
      }
      
      // Extrair IDs dos participantes
      const participantIds = groupData.participants.map((p: any) => String(p.id));
      
      // Dados para criar o grupo
      const newGroupData = {
        isGroup: true,
        name: groupData.name.trim(),
        participants: participantIds,
        createdBy: String(user.id)
      };
      
      console.log("Enviando dados para criação de grupo:", newGroupData);
      
      // Enviar solicitação via socket
      socket.emit("chat:create", newGroupData);
      
      // Fechar modal
      setIsCreatingGroup(false);
      
      // Fechar a gaveta em dispositivos móveis
      if (window.innerWidth <= 768) {
        setSidebarOpen(false)
      }
      
      // Mostrar mensagem de sucesso
      toast({
        title: "Grupo criado",
        description: "O grupo foi criado. Aguardando confirmação do servidor..."
      });
    } catch (error) {
      console.error("Erro ao criar grupo:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao criar o grupo. Tente novamente.",
        variant: "destructive",
      });
    }
  }

  // Formatação de data/hora
  const formatMessageTime = (timestamp: string) => {
    if (!timestamp) return "";
    
    const messageDate = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Se for hoje, mostra apenas a hora
    if (messageDate >= today) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Se for ontem, mostra "Ontem" e a hora
    if (messageDate >= yesterday && messageDate < today) {
      return `Ontem ${messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Caso contrário, mostra a data completa
    return messageDate.toLocaleDateString() + ' ' + 
           messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hidden audio element for notifications */}
      <audio ref={notificationSound} src="/notification.mp3" />

      {/* Mobile Drawer Overlay - Visible only on mobile when drawer is open */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-10 animate-in fade-in duration-200" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Mobile Drawer */}
      <div 
        className={`
          md:flex md:relative md:z-auto fixed z-20 h-full flex-col w-[85%] sm:w-[70%] md:w-80 
          border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 
          transition-all duration-300 ease-in-out drawer-transition
          ${sidebarOpen ? 'flex drawer-open' : 'hidden md:hidden drawer-closed'}
        `}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarImage src={user?.avatar || "/placeholder.svg?height=32&width=32"} />
              <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium">{user?.name}</h3>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditingProfile(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Editar perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsManagingBackup(true)}>
                  <Database className="h-4 w-4 mr-2" />
                  Backup
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsViewingHistory(true)}>
                  <History className="h-4 w-4 mr-2" />
                  Histórico
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="md:hidden ml-2" onClick={() => setSidebarOpen(false)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="p-4 flex items-center justify-between">
            <TabsList className="flex justify-center space-x-8 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl p-2">
              <TabsTrigger value="chats" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 rounded-lg px-4 transition-all">
                <MessageSquare className="h-5 w-5 text-gray-900 dark:text-gray-300" />
              </TabsTrigger>
              <TabsTrigger value="groups" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 rounded-lg px-4 transition-all">
                <Users className="h-5 w-5 text-gray-900 dark:text-gray-300" />
              </TabsTrigger>
              <TabsTrigger value="users" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 rounded-lg px-4 transition-all">
                <User className="h-5 w-5 text-gray-900 dark:text-gray-300" />
              </TabsTrigger>
            </TabsList>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsCreatingGroup(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Criar grupo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsManagingTags(true)}>
                  <Tag className="h-4 w-4 mr-2" />
                  Gerenciar tags
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <TabsContent value="chats" className="m-0">
            <ScrollArea className="flex-1">
              {(activeFilters.tags.length > 0 || activeFilters.query || activeFilters.showArchived
                ? filteredChats
                : chats
              ).map((chat) => (
                <div
                  key={chat.id}
                  className={cn(
                    "flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700",
                    activeChat?.id === chat.id && "bg-gray-100 dark:bg-gray-700"
                  )}
                  onClick={() => handleChatSelect(chat)}
                >
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      {chat.is_group ? (
                        chat.avatar ? (
                          <AvatarImage src={chat.avatar} />
                        ) : (
                          <AvatarFallback className="bg-green-500">{chat.name?.charAt(0)}</AvatarFallback>
                        )
                      ) : (
                        <>
                          <AvatarImage src={chat.participants[0]?.avatar || "/placeholder.svg?height=40&width=40"} />
                          <AvatarFallback>{chat.participants[0]?.name?.charAt(0)}</AvatarFallback>
                        </>
                      )}
                    </Avatar>
                    <div>
                      <div className="flex items-center">
                        <h4 className="font-medium">{chat.is_group ? chat.name : chat.participants[0]?.name}</h4>
                        {chat.muted && (
                          <BellOff className="h-4 w-4 text-gray-500" />
                        )}
                        {chat.pinnedMessages?.length > 0 && <Pin className="h-3 w-3 ml-1 text-yellow-500" />}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate w-40">
                        {chat.lastMessage?.content || "Nenhuma mensagem ainda"}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {chat.is_group && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveChat(chat)
                            setIsEditingGroup(true)
                          }}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Editar grupo
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleMute(chat.id)
                        }}
                      >
                        {chat.muted ? (
                          <>
                            <Bell className="h-4 w-4 mr-2" />
                            Ativar notificações
                          </>
                        ) : (
                          <>
                            <BellOff className="h-4 w-4 mr-2" />
                            Silenciar notificações
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveChat(chat)
                          setIsManagingBackup(true)
                        }}
                      >
                        <Database className="h-4 w-4 mr-2" />
                        Backup de conversa
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteChat(chat.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir conversa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="groups" className="m-0 p-4">
            <ScrollArea className="flex-1">
              <div className="space-y-1 p-2">
                {chats
                  .filter(chat => chat.is_group)
                  .map((chat) => (
                  <div
                    key={chat.id}
                    className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer ${
                      activeChat?.id === chat.id ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-900"
                    }`}
                    onClick={() => handleChatSelect(chat)}
                  >
                    <Avatar>
                      {chat.avatar ? (
                        <AvatarImage src={chat.avatar} />
                      ) : (
                        <AvatarImage src="/placeholder-group.png" />
                      )}
                      <AvatarFallback>
                        {chat.name?.charAt(0) || "G"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium leading-none truncate">
                          {chat.name || "Grupo"}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleMute(chat.id)
                          }}
                        >
                          {chat.muted ? (
                            <BellOff className="h-4 w-4" />
                          ) : (
                            <Bell className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-gray-500 truncate dark:text-gray-400">
                        {chat.lastMessage ? chat.lastMessage.content : "Nenhuma mensagem"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="users" className="m-0 p-4">
            <UserList currentUserId={user?.id} onUserSelect={handleUserSelect} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Main chat container */}
      <div className="flex-1 flex flex-col">
        {/* Chat header */}
        {activeChat ? (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
            <div className="flex items-center">
              {/* Mobile menu button */}
              <Button variant="ghost" size="icon" className="mr-2 md:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-6 w-6 text-primary" />
              </Button>
              
              <Avatar className="mr-3">
                {activeChat.is_group ? (
                  activeChat.avatar ? (
                    <AvatarImage src={activeChat.avatar} />
                  ) : (
                    <AvatarFallback className="bg-green-500">{activeChat.name?.charAt(0)}</AvatarFallback>
                  )
                ) : (
                  <>
                    <AvatarImage src={activeChat.participants[0]?.avatar || "/placeholder.svg?height=40&width=40"} />
                    <AvatarFallback>{activeChat.participants[0]?.name?.charAt(0)}</AvatarFallback>
                  </>
                )}
              </Avatar>
              <div>
                <h3 className="font-semibold">
                  {activeChat.is_group ? activeChat.name : activeChat.participants[0]?.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {activeChat.is_group
                    ? `${activeChat.participants.length} participantes`
                    : activeChat.participants[0]?.is_online
                    ? "Online"
                    : activeChat.participants[0]?.last_seen
                    ? `Visto por último: ${formatMessageTime(activeChat.participants[0]?.last_seen)}`
                    : "Offline"}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSearching(true)}
                title="Pesquisar mensagens"
              >
                <Search className="h-5 w-5" />
              </Button>
              {activeChat.is_group && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsEditingGroup(true)
                  }}
                >
                  <Settings className="h-5 w-5" />
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" title="Mais opções">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsCreatingPoll(true)}>
                    <BarChart2 className="h-4 w-4 mr-2" />
                    Criar enquete
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShareLocation}>
                    <MapPin className="h-4 w-4 mr-2" />
                    Compartilhar localização
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsViewingHistory(true)}>
                    <History className="h-4 w-4 mr-2" />
                    Histórico de ações
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsManagingBackup(true)}>
                    <Database className="h-4 w-4 mr-2" />
                    Backup e restauração
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
            <div className="flex items-center">
              {/* Mobile menu button when no chat is selected */}
              <Button variant="ghost" size="icon" className="mr-2 md:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-6 w-6 text-primary" />
              </Button>
              <h3 className="font-medium">Chat em Tempo Real</h3>
            </div>
          </div>
        )}
        
        {activeChat ? (
          <>
            {/* Pinned Messages */}
            {activeChat.pinnedMessages && activeChat.pinnedMessages.length > 0 && (
              <div className="py-2 px-4 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-100 dark:border-yellow-800/20">
                <div className="flex items-center space-x-2">
                  <Pin className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300">
                      Mensagem fixada
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 truncate">
                      {activeChat.pinnedMessages[0].content}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-800/20"
                    onClick={() => handlePinMessage(activeChat.pinnedMessages[0].id, false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    currentUserId={String(user?.id)}
                    onDelete={handleDeleteMessage}
                    onReply={handleReplyMessage}
                    onQuote={handleQuoteMessage}
                    onPin={handlePinMessage}
                    onReactionAdd={handleReactionAdd}
                    onVote={(messageId, optionId) => {
                      if (message.type === "poll" && message.poll) {
                        handleVotePoll(messageId, optionId);
                      }
                    }}
                    pinnedMessages={activeChat.pinnedMessages || []}
                    onFilePreview={(file) => {
                      setSelectedFile(file)
                      setIsPreviewingFile(true)
                    }}
                    participants={activeChat?.participants || []}
                    isOwnMessage={String(message.sender?.id) === String(user?.id)}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message input */}
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              {replyingTo && (
                <div className="p-2 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-6 bg-blue-500 rounded-full" />
                    <div>
                      <p className="text-xs font-medium">Respondendo para {replyingTo.sender.name}</p>
                      <p className="text-xs text-gray-500 truncate w-80">{replyingTo.content}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyingTo(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {quotePreview && (
                <div className="p-2 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-6 bg-blue-500 rounded-full" />
                    <div>
                      <p className="text-xs font-medium">Citando mensagem de {quotePreview.sender.name}</p>
                      <p className="text-xs text-gray-500 truncate w-80">{quotePreview.content}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setQuotePreview(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <MessageInput
                  value={inputMessage}
                  onChange={setInputMessage}
                  onSendMessage={handleSendMessage}
                  onAttachmentClick={() => setIsUploading(true)}
                  onRecordClick={() => setIsRecordingAudio(!isRecordingAudio)}
                  onScheduleClick={() => setIsSchedulingMessage(true)}
                  replyingTo={replyingTo}
                />

                {isRecordingAudio && (
                  <div className="mt-2">
                    <AudioRecorder
                      onRecordingComplete={(audioBlob) => {
                        if (!socket || !activeChat) return

                        // Create FormData to upload audio
                        const formData = new FormData()
                        formData.append("audio", audioBlob, "audio.mp3")

                        // Upload audio
                        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload/audio`, {
                          method: "POST",
                          body: formData,
                          headers: {
                            Authorization: `Bearer ${localStorage.getItem("token")}`,
                          },
                        })
                          .then((response) => response.json())
                          .then((data) => {
                            // Send audio message
                            socket.emit("message:send", {
                              chatId: activeChat.id,
                              sender: user,
                              content: data.audioUrl,
                              fileName: "Audio Recording",
                              timestamp: new Date().toISOString(),
                              type: "audio",
                              replyTo: replyingTo,
                            })
                            setIsRecordingAudio(false)
                            setReplyingTo(null)
                            toast({
                              title: "Áudio enviado",
                              description: "Sua mensagem de áudio foi enviada com sucesso.",
                            })
                          })
                          .catch((error) => {
                            console.error("Error uploading audio:", error)
                            toast({
                              title: "Erro",
                              description: "Ocorreu um erro ao enviar o áudio. Tente novamente.",
                              variant: "destructive",
                            })
                          })
                      }}
                      onCancel={() => setIsRecordingAudio(false)}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Selecione uma conversa para começar</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Ou crie um novo grupo para conversar com várias pessoas
              </p>
              <Button className="mt-4" onClick={() => setIsCreatingGroup(true)}>
                <Users className="h-5 w-5 mr-2" />
                Criar Grupo
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {isSearching && (
        <SearchMessages
          chatId={activeChat?.id}
          onClose={() => setIsSearching(false)}
          onMessageSelect={(messageId) => {
            const element = document.getElementById(`message-${messageId}`)
            if (element) {
              element.scrollIntoView({ behavior: "smooth" })
              element.classList.add("bg-yellow-100", "dark:bg-yellow-900/20")
              setTimeout(() => {
                element.classList.remove("bg-yellow-100", "dark:bg-yellow-900/20")
              }, 2000)
            }
          }}
        />
      )}

      {isUploading && (
        <FileUpload
          chatId={activeChat.id}
          senderId={user.id}
          onClose={() => setIsUploading(false)}
          onUploadComplete={(fileUrl, fileType, fileName) => {
            if (socket && activeChat) {
              socket.emit("message:send", {
                chatId: activeChat.id,
                sender: user,
                content: fileUrl,
                timestamp: new Date().toISOString(),
                type: fileType.startsWith("image/") ? "image" : "file",
                fileName,
                replyTo: replyingTo,
              })

              setReplyingTo(null)
            }
            setIsUploading(false)
          }}
        />
      )}

      {isEditingProfile && user && (
        <ProfileEditor user={user} onClose={() => setIsEditingProfile(false)} onProfileUpdate={handleProfileUpdate} />
      )}

      {isEditingGroup && activeChat && (
        <GroupSettings
          group={activeChat}
          userId={user?.id}
          isAdmin={isAdmin}
          tags={tags}
          onClose={() => setIsEditingGroup(false)}
          onGroupUpdate={handleGroupUpdate}
        />
      )}

      {isManagingBackup && (
        <BackupManager chatId={activeChat?.id} userId={user?.id} onClose={() => setIsManagingBackup(false)} />
      )}

      {isTranslating && messageToTranslate && (
        <MessageTranslator
          message={messageToTranslate}
          onClose={() => {
            setIsTranslating(false)
            setMessageToTranslate(null)
          }}
          onTranslate={(messageId, translatedText) => {
            // Update message with translation
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === messageId) {
                  return {
                    ...msg,
                    translatedContent: translatedText,
                  }
                }
                return msg
              }),
            )
          }}
        />
      )}

      {isCreatingPoll && (
        <CreatePoll
          chatId={activeChat.id}
          onClose={() => setIsCreatingPoll(false)}
          onPollCreate={handleCreatePoll}
        />
      )}

      {isViewingHistory && (
        <ActionHistory
          chatId={activeChat?.id}
          userId={user?.id}
          isAdmin={isAdmin}
          onClose={() => setIsViewingHistory(false)}
        />
      )}

      {isSchedulingMessage && (
        <Dialog open={true} onOpenChange={() => setIsSchedulingMessage(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Agendar Mensagem</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scheduled-message">Mensagem</Label>
                <Input
                  id="scheduled-message"
                  value={scheduledMessage.content}
                  onChange={(e) => setScheduledMessage((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="Digite sua mensagem..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled-date">Data e Hora</Label>
                <Input
                  id="scheduled-date"
                  type="datetime-local"
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : null
                    setScheduledMessage((prev) => ({ ...prev, date }))
                  }}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSchedulingMessage(false)}>
                Cancelar
              </Button>
              <Button onClick={handleScheduleMessage}>Agendar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isSharingLocation && (
        <Dialog open={true} onOpenChange={() => setIsSharingLocation(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Compartilhar Localização</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {location ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Sua localização:</p>
                  <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md">
                    <p className="text-sm">Latitude: {location.latitude}</p>
                    <p className="text-sm">Longitude: {location.longitude}</p>
                    {location.address && <p className="text-sm mt-2">{location.address}</p>}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center p-8">
                  <p className="text-sm text-gray-500">Obtendo sua localização...</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSharingLocation(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSendLocation} disabled={!location}>
                Compartilhar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isManagingTags && (
        <TagManager
          userId={user?.id}
          isAdmin={true} // Você pode ajustar isso com base na lógica de permissões
          onClose={() => setIsManagingTags(false)}
          onTagsUpdated={fetchTags}
        />
      )}

      {isCreatingGroup && (
        <CreateGroup
          userId={user?.id}
          onClose={() => setIsCreatingGroup(false)}
          onGroupCreated={(groupData) => {
            if (socket && user) {
              try {
                // Log para debug
                console.log("Tentando criar grupo:", groupData);
                
                // Verificar se temos o nome do grupo
                if (!groupData.name?.trim()) {
                  toast({
                    title: "Erro",
                    description: "O nome do grupo é obrigatório",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Verificar se temos participantes
                if (!groupData.participants?.length) {
                  toast({
                    title: "Erro",
                    description: "Selecione pelo menos um participante para o grupo",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Extrair IDs dos participantes
                const participantIds = groupData.participants.map((p: any) => String(p.id));
                
                // Dados para criar o grupo
                const newGroupData = {
                  isGroup: true,
                  name: groupData.name.trim(),
                  participants: participantIds,
                  createdBy: String(user.id)
                };
                
                console.log("Enviando dados para criação de grupo:", newGroupData);
                
                // Enviar solicitação via socket
                socket.emit("chat:create", newGroupData);
                
                // Fechar modal
                setIsCreatingGroup(false);
                
                // Fechar a gaveta em dispositivos móveis
                if (window.innerWidth <= 768) {
                  setSidebarOpen(false)
                }
                
                // Mostrar mensagem de sucesso
                toast({
                  title: "Grupo criado",
                  description: "O grupo foi criado. Aguardando confirmação do servidor..."
                });
              } catch (error) {
                console.error("Erro ao criar grupo:", error);
                toast({
                  title: "Erro",
                  description: "Ocorreu um erro ao criar o grupo. Tente novamente.",
                  variant: "destructive",
                });
              }
            } else {
              toast({
                title: "Erro de conexão",
                description: "Não foi possível criar o grupo. Verifique sua conexão.",
                variant: "destructive",
              });
            }
          }}
        />
      )}
    </div>
  )
}

