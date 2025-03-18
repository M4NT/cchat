"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Filter, TagIcon, Search, Archive, CheckSquare, Square, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ChatFilterProps {
  userId: string
  onClose: () => void
  onFilter: (filters: any) => void
}

export default function ChatFilter({ userId, onClose, onFilter }: ChatFilterProps) {
  const [tags, setTags] = useState<any[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchTags()
  }, [])

  const fetchTags = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tags`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })

      if (!response.ok) {
        throw new Error("Falha ao carregar tags")
      }

      const data = await response.json()
      setTags(data.tags)
    } catch (error) {
      console.error("Error fetching tags:", error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar as tags",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleTag = (tagId: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId)
      } else {
        return [...prev, tagId]
      }
    })
  }

  const handleApplyFilter = () => {
    onFilter({
      tags: selectedTags,
      query: searchQuery,
      showArchived,
    })
    onClose()
  }

  const handleClearFilter = () => {
    setSelectedTags([])
    setSearchQuery("")
    setShowArchived(false)
    onFilter({
      tags: [],
      query: "",
      showArchived: false,
    })
    onClose()
  }

  // Helper function to render tag badge
  const renderTagBadge = (tag: any) => (
    <Badge
      style={{
        backgroundColor: tag.color,
        color: isLightColor(tag.color) ? "#000" : "#fff",
      }}
      className="flex items-center gap-1 px-2 py-1"
    >
      {tag.icon && getIconComponent(tag.icon)}
      {tag.name}
    </Badge>
  )

  // Helper function to determine if a color is light
  const isLightColor = (color: string) => {
    const hex = color.replace("#", "")
    const r = Number.parseInt(hex.substr(0, 2), 16)
    const g = Number.parseInt(hex.substr(2, 2), 16)
    const b = Number.parseInt(hex.substr(4, 2), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness > 155
  }

  // Helper function to get icon component
  const getIconComponent = (iconName: string) => {
    // This would be implemented with the appropriate icon components
    return <TagIcon className="h-3 w-3" />
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Filtrar Conversas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar por nome ou conteúdo..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Filtrar por Tags</h3>
              {selectedTags.length > 0 && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setSelectedTags([])}>
                  Limpar ({selectedTags.length})
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="p-4 text-center text-gray-500">Carregando tags...</div>
            ) : tags.length > 0 ? (
              <ScrollArea className="h-40">
                <div className="grid grid-cols-2 gap-2 p-1">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className={`flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${
                        selectedTags.includes(tag.id) ? "bg-gray-100 dark:bg-gray-800" : ""
                      }`}
                      onClick={() => handleToggleTag(tag.id)}
                    >
                      {selectedTags.includes(tag.id) ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-500" />
                      )}
                      <div className="flex-1 truncate">{renderTagBadge(tag)}</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="p-4 text-center text-gray-500">Nenhuma tag disponível</div>
            )}
          </div>

          <div
            className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4 text-gray-500" />
            )}
            <div className="flex items-center space-x-2">
              <Archive className="h-4 w-4" />
              <span>Mostrar conversas arquivadas</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={handleClearFilter}>
              <X className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
            <Button onClick={handleApplyFilter}>
              <Filter className="h-4 w-4 mr-2" />
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

