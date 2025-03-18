"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, Clock } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"

interface SearchMessagesProps {
  chatId?: string
  onClose: () => void
  onMessageSelect: (messageId: string) => void
}

interface Message {
  id: string
  content: string
  sender: {
    name: string
  }
  timestamp: string
  type: string
}

export default function SearchMessages({ chatId, onClose, onMessageSelect }: SearchMessagesProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Message[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const { toast } = useToast()

  const handleSearch = async () => {
    if (!searchQuery.trim() || !chatId) {
      toast({
        title: "Erro",
        description: "Digite algo para pesquisar",
        variant: "destructive",
      })
      return
    }

    setIsSearching(true)

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/messages/search?chatId=${chatId}&query=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error("Falha ao pesquisar mensagens")
      }

      const data = await response.json()
      setSearchResults(data.messages || [])

      if (data.messages.length === 0) {
        toast({
          title: "Nenhum resultado",
          description: "Nenhuma mensagem encontrada com esses termos",
        })
      }
    } catch (error) {
      console.error("Error searching messages:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao pesquisar mensagens",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const renderMessagePreview = (message: Message) => {
    if (message.type === "text") {
      // Highlight the search term in the message content
      const parts = message.content.split(new RegExp(`(${searchQuery})`, "gi"))

      return (
        <p className="text-sm line-clamp-2">
          {parts.map((part, i) =>
            part.toLowerCase() === searchQuery.toLowerCase() ? (
              <span key={i} className="bg-yellow-200 dark:bg-yellow-800">
                {part}
              </span>
            ) : (
              part
            ),
          )}
        </p>
      )
    } else if (message.type === "image") {
      return <p className="text-sm text-gray-500">[Imagem]</p>
    } else if (message.type === "audio") {
      return <p className="text-sm text-gray-500">[Mensagem de áudio]</p>
    } else if (message.type === "file") {
      return <p className="text-sm text-gray-500">[Arquivo anexado]</p>
    } else if (message.type === "location") {
      return <p className="text-sm text-gray-500">[Localização]</p>
    } else if (message.type === "poll") {
      return <p className="text-sm text-gray-500">[Enquete]</p>
    }

    return <p className="text-sm line-clamp-2">{message.content}</p>
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pesquisar Mensagens</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Digite para pesquisar..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? "Pesquisando..." : "Pesquisar"}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((message) => (
                <div
                  key={message.id}
                  className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={() => {
                    onMessageSelect(message.id)
                    onClose()
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{message.sender.name}</p>
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      {format(new Date(message.timestamp), "dd/MM/yyyy HH:mm")}
                    </div>
                  </div>
                  {renderMessagePreview(message)}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

