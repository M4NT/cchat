"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Search, 
  Clock, 
  Calendar,
  Filter,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { format, isAfter, isBefore, parseISO } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ptBR } from "date-fns/locale"

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
  const [filteredResults, setFilteredResults] = useState<Message[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: ""
  })
  const [messageTypes, setMessageTypes] = useState({
    text: true,
    image: true,
    audio: true,
    file: true,
    location: true,
    poll: true
  })
  const popoverTriggerRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast()

  // Inicializar os resultados filtrados quando os resultados da pesquisa mudam
  useEffect(() => {
    if (searchResults.length > 0) {
      setFilteredResults(searchResults);
    }
  }, [searchResults]);

  const handleSearch = async () => {
    if (!searchQuery.trim() && !chatId) {
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
        `${process.env.NEXT_PUBLIC_API_URL}/api/messages/search?chatId=${chatId}&query=${encodeURIComponent(searchQuery || '')}`,
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
      const messages = data.messages || []
      setSearchResults(messages)
      setFilteredResults(messages) // Inicializa os resultados filtrados com todos os resultados

      if (messages.length === 0) {
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

  const applyFilters = () => {
    if (searchResults.length === 0) return;
    
    console.log("Aplicando filtros", { messageTypes, dateRange });
    let filtered = [...searchResults];
    
    // Filtrar por tipo de mensagem
    filtered = filtered.filter(message => {
      if (message.type === "text") return messageTypes.text;
      if (message.type === "image") return messageTypes.image;
      if (message.type === "audio") return messageTypes.audio;
      if (message.type === "file") return messageTypes.file;
      if (message.type === "location") return messageTypes.location;
      if (message.type === "poll") return messageTypes.poll;
      return true;
    });
    
    // Filtrar por data
    if (dateRange.startDate) {
      const startDate = parseISO(dateRange.startDate);
      filtered = filtered.filter(message => 
        isAfter(new Date(message.timestamp), startDate) || 
        format(new Date(message.timestamp), "yyyy-MM-dd") === format(startDate, "yyyy-MM-dd")
      );
    }
    
    if (dateRange.endDate) {
      const endDate = parseISO(dateRange.endDate);
      // Adicionar 1 dia ao final para incluir mensagens do último dia
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      filtered = filtered.filter(message => 
        isBefore(new Date(message.timestamp), nextDay)
      );
    }
    
    console.log("Resultados filtrados:", filtered.length);
    setFilteredResults(filtered);
    
    // Notificar o usuário sobre os resultados do filtro
    if (filtered.length === 0) {
      toast({
        title: "Nenhum resultado",
        description: "Nenhuma mensagem encontrada com os filtros aplicados",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Filtros aplicados",
        description: `${filtered.length} mensagens encontradas`,
      });
    }
  }

  const handleApplyFilters = () => {
    applyFilters();
    // Fechar o popover após aplicar os filtros
    setIsFiltersOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  // Resetar filtros
  const resetFilters = () => {
    setDateRange({
      startDate: "",
      endDate: ""
    });
    
    setMessageTypes({
      text: true,
      image: true,
      audio: true,
      file: true,
      location: true,
      poll: true
    });
    
    // Restaurar todos os resultados originais
    setFilteredResults(searchResults);
    
    toast({
      title: "Filtros resetados",
      description: "Todos os resultados estão sendo exibidos"
    });
  }

  const toggleMessageType = (type: keyof typeof messageTypes) => {
    setMessageTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
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
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pesquisar Mensagens</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Digite para pesquisar..."
                className="pl-8 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300 dark:focus-visible:border-gray-600 border-gray-300 dark:border-gray-600"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ outline: 'none', boxShadow: 'none' }}
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? "Pesquisando..." : "Pesquisar"}
            </Button>
            
            <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
              <PopoverTrigger asChild>
                <Button 
                  ref={popoverTriggerRef}
                  variant="outline" 
                  size="icon"
                  className="relative"
                  title="Filtros de pesquisa"
                  aria-label="Filtros de pesquisa"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-80 p-4" 
                side="right" 
                align="start"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Filtros</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={resetFilters}
                    >
                      Resetar
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="date-from">Data inicial</Label>
                    <Input
                      id="date-from"
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => {
                        setDateRange(prev => ({ ...prev, startDate: e.target.value }));
                      }}
                      className="focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300 dark:focus-visible:border-gray-600 border-gray-300 dark:border-gray-600"
                      style={{ outline: 'none', boxShadow: 'none' }}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="date-to">Data final</Label>
                    <Input
                      id="date-to"
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => {
                        setDateRange(prev => ({ ...prev, endDate: e.target.value }));
                      }}
                      className="focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300 dark:focus-visible:border-gray-600 border-gray-300 dark:border-gray-600"
                      style={{ outline: 'none', boxShadow: 'none' }}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Tipos de mensagem</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        size="sm"
                        variant={messageTypes.text ? "default" : "outline"}
                        onClick={() => toggleMessageType('text')}
                        className="justify-start"
                      >
                        <span className="truncate">Texto</span>
                      </Button>
                      <Button 
                        size="sm"
                        variant={messageTypes.image ? "default" : "outline"}
                        onClick={() => toggleMessageType('image')}
                        className="justify-start"
                      >
                        <span className="truncate">Imagem</span>
                      </Button>
                      <Button 
                        size="sm"
                        variant={messageTypes.audio ? "default" : "outline"}
                        onClick={() => toggleMessageType('audio')}
                        className="justify-start"
                      >
                        <span className="truncate">Áudio</span>
                      </Button>
                      <Button 
                        size="sm"
                        variant={messageTypes.file ? "default" : "outline"}
                        onClick={() => toggleMessageType('file')}
                        className="justify-start"
                      >
                        <span className="truncate">Arquivo</span>
                      </Button>
                      <Button 
                        size="sm"
                        variant={messageTypes.location ? "default" : "outline"}
                        onClick={() => toggleMessageType('location')}
                        className="justify-start"
                      >
                        <span className="truncate">Local</span>
                      </Button>
                      <Button 
                        size="sm"
                        variant={messageTypes.poll ? "default" : "outline"}
                        onClick={() => toggleMessageType('poll')}
                        className="justify-start"
                      >
                        <span className="truncate">Enquete</span>
                      </Button>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleApplyFilters}
                    className="w-full"
                  >
                    Aplicar filtros
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {searchResults.length > 0 && (
            <>
              <div className="text-sm text-gray-500 flex justify-between items-center">
                <span>Resultados: {filteredResults.length} mensagens</span>
              </div>
              
              <ScrollArea className="flex-1 max-h-[400px] pr-4">
                <div className="space-y-2">
                  {filteredResults.map((message) => (
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
                          {format(new Date(message.timestamp), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                      {renderMessagePreview(message)}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

