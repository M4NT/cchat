"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Edit, TagIcon, Search, Check, X, Users, MessageSquare } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { HexColorPicker } from "react-colorful"

interface TagManagerProps {
  userId: string
  isAdmin: boolean
  onClose: () => void
  onTagsUpdated?: () => void
}

interface Tag {
  id: string
  name: string
  description?: string
  color: string
  icon?: string
  createdBy: string
  createdAt: string
}

interface Permission {
  id: string
  tagId: string
  name: string
  value: boolean
}

const AVAILABLE_PERMISSIONS = [
  { name: "admin_access", label: "Acesso de Administrador" },
  { name: "manage_users", label: "Gerenciar Usuários" },
  { name: "manage_groups", label: "Gerenciar Grupos" },
  { name: "manage_tags", label: "Gerenciar Tags" },
  { name: "view_logs", label: "Visualizar Logs" },
  { name: "export_data", label: "Exportar Dados" },
  { name: "delete_messages", label: "Excluir Mensagens" },
  { name: "pin_messages", label: "Fixar Mensagens" },
]

const AVAILABLE_ICONS = [
  "tag",
  "briefcase",
  "building",
  "code",
  "database",
  "dollar-sign",
  "file-text",
  "globe",
  "heart",
  "home",
  "mail",
  "map",
  "phone",
  "shield",
  "shopping-cart",
  "star",
  "tool",
  "truck",
  "user",
  "users",
]

export default function TagManager({ userId, isAdmin, onClose, onTagsUpdated }: TagManagerProps) {
  const [activeTab, setActiveTab] = useState("manage")
  const [tags, setTags] = useState<Tag[]>([])
  const [filteredTags, setFilteredTags] = useState<Tag[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [tagPermissions, setTagPermissions] = useState<Permission[]>([])

  // Form states
  const [tagName, setTagName] = useState("")
  const [tagDescription, setTagDescription] = useState("")
  const [tagColor, setTagColor] = useState("#6b7280")
  const [tagIcon, setTagIcon] = useState("tag")
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [permissions, setPermissions] = useState<{ [key: string]: boolean }>({})

  const { toast } = useToast()

  useEffect(() => {
    fetchTags()
  }, [])

  useEffect(() => {
    if (searchQuery) {
      setFilteredTags(
        tags.filter(
          (tag) =>
            tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (tag.description && tag.description.toLowerCase().includes(searchQuery.toLowerCase())),
        ),
      )
    } else {
      setFilteredTags(tags)
    }
  }, [searchQuery, tags])

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
      setFilteredTags(data.tags)
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

  const fetchTagPermissions = async (tagId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tags/${tagId}/permissions`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })

      if (!response.ok) {
        throw new Error("Falha ao carregar permissões")
      }

      const data = await response.json()
      setTagPermissions(data.permissions)

      // Set permissions state
      const permissionsObj: { [key: string]: boolean } = {}
      data.permissions.forEach((perm: Permission) => {
        permissionsObj[perm.name] = perm.value
      })
      setPermissions(permissionsObj)
    } catch (error) {
      console.error("Error fetching tag permissions:", error)
    }
  }

  const handleSelectTag = (tag: Tag) => {
    setSelectedTag(tag)
    fetchTagPermissions(tag.id)
  }

  const handleEditTag = () => {
    if (!selectedTag) return

    setTagName(selectedTag.name)
    setTagDescription(selectedTag.description || "")
    setTagColor(selectedTag.color)
    setTagIcon(selectedTag.icon || "tag")
    setIsEditing(true)
  }

  const handleCreateTag = () => {
    setTagName("")
    setTagDescription("")
    setTagColor("#6b7280")
    setTagIcon("tag")
    setPermissions({})
    setIsCreating(true)
  }

  const handleSaveTag = async () => {
    if (!tagName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, insira um nome para a tag",
        variant: "destructive",
      })
      return
    }

    try {
      const tagData = {
        name: tagName,
        description: tagDescription,
        color: tagColor,
        icon: tagIcon,
        permissions: Object.entries(permissions).map(([name, value]) => ({ name, value })),
      }

      let response

      if (isCreating) {
        response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tags`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(tagData),
        })
      } else {
        response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tags/${selectedTag?.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(tagData),
        })
      }

      if (!response.ok) {
        throw new Error(isCreating ? "Falha ao criar tag" : "Falha ao atualizar tag")
      }

      toast({
        title: isCreating ? "Tag criada" : "Tag atualizada",
        description: isCreating ? "A tag foi criada com sucesso" : "A tag foi atualizada com sucesso",
      })

      fetchTags()
      setIsEditing(false)
      setIsCreating(false)
      if (onTagsUpdated) onTagsUpdated()
    } catch (error) {
      console.error("Error saving tag:", error)
      toast({
        title: "Erro",
        description: isCreating ? "Não foi possível criar a tag" : "Não foi possível atualizar a tag",
        variant: "destructive",
      })
    }
  }

  const handleDeleteTag = async () => {
    if (!selectedTag) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tags/${selectedTag.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })

      if (!response.ok) {
        throw new Error("Falha ao excluir tag")
      }

      toast({
        title: "Tag excluída",
        description: "A tag foi excluída com sucesso",
      })

      setTags(tags.filter((tag) => tag.id !== selectedTag.id))
      setSelectedTag(null)
      if (onTagsUpdated) onTagsUpdated()
    } catch (error) {
      console.error("Error deleting tag:", error)
      toast({
        title: "Erro",
        description: "Não foi possível excluir a tag",
        variant: "destructive",
      })
    }
  }

  const handlePermissionChange = (permissionName: string, checked: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [permissionName]: checked,
    }))
  }

  const renderTagBadge = (tag: Tag) => (
    <Badge
      style={{
        backgroundColor: tag.color,
        color: isLightColor(tag.color) ? "#000" : "#fff",
      }}
      className="flex items-center gap-1 px-2 py-1"
    >
      {getIconComponent(tag.icon || "tag")}
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
    switch (iconName) {
      case "briefcase":
        return <Briefcase className="h-3 w-3" />
      case "building":
        return <Building className="h-3 w-3" />
      case "code":
        return <Code className="h-3 w-3" />
      case "database":
        return <Database className="h-3 w-3" />
      case "dollar-sign":
        return <DollarSign className="h-3 w-3" />
      case "file-text":
        return <FileText className="h-3 w-3" />
      case "globe":
        return <Globe className="h-3 w-3" />
      case "heart":
        return <Heart className="h-3 w-3" />
      case "home":
        return <Home className="h-3 w-3" />
      case "mail":
        return <Mail className="h-3 w-3" />
      case "map":
        return <Map className="h-3 w-3" />
      case "phone":
        return <Phone className="h-3 w-3" />
      case "shield":
        return <Shield className="h-3 w-3" />
      case "shopping-cart":
        return <ShoppingCart className="h-3 w-3" />
      case "star":
        return <Star className="h-3 w-3" />
      case "tool":
        return <Tool className="h-3 w-3" />
      case "truck":
        return <Truck className="h-3 w-3" />
      case "user":
        return <User className="h-3 w-3" />
      case "users":
        return <Users className="h-3 w-3" />
      default:
        return <TagIcon className="h-3 w-3" />
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciador de Tags</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manage">Gerenciar Tags</TabsTrigger>
            <TabsTrigger value="assign">Atribuir Tags</TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="mt-4">
            {isEditing || isCreating ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tag-name">Nome da Tag</Label>
                  <Input
                    id="tag-name"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    placeholder="Ex: Financeiro, TI, Marketing"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tag-description">Descrição (opcional)</Label>
                  <Input
                    id="tag-description"
                    value={tagDescription}
                    onChange={(e) => setTagDescription(e.target.value)}
                    placeholder="Descreva o propósito desta tag"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full flex justify-between"
                          style={{ backgroundColor: tagColor }}
                        >
                          <span style={{ color: isLightColor(tagColor) ? "#000" : "#fff" }}>{tagColor}</span>
                          <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: tagColor }} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <HexColorPicker color={tagColor} onChange={setTagColor} />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Ícone</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full flex justify-between">
                          {getIconComponent(tagIcon)}
                          <span className="ml-2">{tagIcon}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                        <div className="grid grid-cols-4 gap-2 p-2">
                          {AVAILABLE_ICONS.map((icon) => (
                            <Button
                              key={icon}
                              variant="ghost"
                              className="h-10 w-10 p-0 flex items-center justify-center"
                              onClick={() => setTagIcon(icon)}
                            >
                              {getIconComponent(icon)}
                            </Button>
                          ))}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Prévia</Label>
                  <div className="p-2 border rounded-md flex items-center justify-center">
                    <Badge
                      style={{
                        backgroundColor: tagColor,
                        color: isLightColor(tagColor) ? "#000" : "#fff",
                      }}
                      className="flex items-center gap-1 px-2 py-1"
                    >
                      {getIconComponent(tagIcon)}
                      {tagName || "Nome da Tag"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Permissões</Label>
                  <div className="border rounded-md p-2 space-y-2">
                    {AVAILABLE_PERMISSIONS.map((permission) => (
                      <div key={permission.name} className="flex items-center space-x-2">
                        <Checkbox
                          id={`permission-${permission.name}`}
                          checked={permissions[permission.name] || false}
                          onCheckedChange={(checked) => handlePermissionChange(permission.name, checked as boolean)}
                        />
                        <Label htmlFor={`permission-${permission.name}`} className="text-sm cursor-pointer">
                          {permission.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false)
                      setIsCreating(false)
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveTag}>{isCreating ? "Criar" : "Salvar"}</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Buscar tags..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {isAdmin && (
                    <Button onClick={handleCreateTag}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Tag
                    </Button>
                  )}
                </div>

                <div className="border rounded-md">
                  <div className="p-2 border-b bg-gray-50 dark:bg-gray-800 flex items-center">
                    <TagIcon className="h-4 w-4 mr-2" />
                    <span className="text-sm font-medium">Tags ({filteredTags.length})</span>
                  </div>

                  {isLoading ? (
                    <div className="p-4 text-center text-gray-500">Carregando tags...</div>
                  ) : filteredTags.length > 0 ? (
                    <ScrollArea className="h-60">
                      <div className="p-2 space-y-2">
                        {filteredTags.map((tag) => (
                          <div
                            key={tag.id}
                            className={`flex items-center justify-between p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${
                              selectedTag?.id === tag.id ? "bg-gray-100 dark:bg-gray-800" : ""
                            }`}
                            onClick={() => handleSelectTag(tag)}
                          >
                            <div className="flex items-center space-x-2">
                              {renderTagBadge(tag)}
                              {tag.description && (
                                <span className="text-xs text-gray-500 ml-2 truncate max-w-[150px]">
                                  {tag.description}
                                </span>
                              )}
                            </div>
                            {isAdmin && selectedTag?.id === tag.id && (
                              <div className="flex space-x-1">
                                <Button variant="ghost" size="icon" onClick={handleEditTag}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={handleDeleteTag}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      {searchQuery ? "Nenhuma tag encontrada" : "Nenhuma tag criada"}
                    </div>
                  )}
                </div>

                {selectedTag && (
                  <div className="border rounded-md p-3 space-y-2">
                    <h4 className="font-medium">Detalhes da Tag</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Nome:</span>
                        <p>{selectedTag.name}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Criada por:</span>
                        <p>Admin</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Descrição:</span>
                        <p>{selectedTag.description || "Sem descrição"}</p>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium mb-1">Permissões:</h5>
                      <div className="grid grid-cols-2 gap-1">
                        {tagPermissions.length > 0 ? (
                          tagPermissions.map((permission) => (
                            <div key={permission.id} className="flex items-center text-xs">
                              {permission.value ? (
                                <Check className="h-3 w-3 text-green-500 mr-1" />
                              ) : (
                                <X className="h-3 w-3 text-red-500 mr-1" />
                              )}
                              {AVAILABLE_PERMISSIONS.find((p) => p.name === permission.name)?.label || permission.name}
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-gray-500 col-span-2">Nenhuma permissão definida</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="assign" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Button variant="outline" className="flex-1">
                  <Users className="h-4 w-4 mr-2" />
                  Atribuir a Usuários
                </Button>
                <Button variant="outline" className="flex-1">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Atribuir a Grupos
                </Button>
              </div>

              <div className="border rounded-md">
                <div className="p-2 border-b bg-gray-50 dark:bg-gray-800">
                  <span className="text-sm font-medium">Tags Disponíveis</span>
                </div>

                {isLoading ? (
                  <div className="p-4 text-center text-gray-500">Carregando tags...</div>
                ) : tags.length > 0 ? (
                  <ScrollArea className="h-60">
                    <div className="p-2 grid grid-cols-2 gap-2">
                      {tags.map((tag) => (
                        <div
                          key={tag.id}
                          className="p-2 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <div className="flex justify-between items-start mb-1">
                            {renderTagBadge(tag)}
                            <Checkbox id={`select-tag-${tag.id}`} />
                          </div>
                          {tag.description && <p className="text-xs text-gray-500 truncate">{tag.description}</p>}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="p-4 text-center text-gray-500">Nenhuma tag disponível</div>
                )}
              </div>

              <div className="flex justify-end">
                <Button>Aplicar Tags Selecionadas</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Importações dos ícones
import {
  Briefcase,
  Building,
  Code,
  Database,
  DollarSign,
  FileText,
  Globe,
  Heart,
  Home,
  Mail,
  Map,
  Phone,
  Shield,
  ShoppingCart,
  Star,
  PenToolIcon as Tool,
  Truck,
  User,
} from "lucide-react"

