"use client"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import {
  Archive,
  Settings,
  Trash2,
  Check,
  UserPlus,
  UserMinus,
  Search,
  Tag as TagIcon,
  Camera,
  Shield,
  X
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"

interface GroupSettingsProps {
  group: any
  userId: string
  isAdmin: boolean
  tags: any[]
  onClose: () => void
  onGroupUpdate: (updatedGroup: any) => void
}

export default function GroupSettings({ group, userId, isAdmin, tags, onClose, onGroupUpdate }: GroupSettingsProps) {
  const [activeTab, setActiveTab] = useState("general")
  const [groupName, setGroupName] = useState(group.name)
  const [groupAvatar, setGroupAvatar] = useState<string | null>(group.avatar || null)
  const [newAvatar, setNewAvatar] = useState<File | null>(null)
  const [groupSettings, setGroupSettings] = useState<any>(
    group.settings || {
      onlyAdminsCanAddMembers: false,
      onlyAdminsCanChangeInfo: true,
      onlyAdminsCanSendMessages: false,
      muteNotifications: false,
      archiveChat: false,
    },
  )
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [groupTags, setGroupTags] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [isAddingMembers, setIsAddingMembers] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchGroupTags()
  }, [])

  const fetchGroupTags = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chats/${group.id}/tags`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })

      if (!response.ok) {
        console.warn("Não foi possível carregar as tags do grupo")
        return
      }

      const data = await response.json()
      
      if (data && data.tags && Array.isArray(data.tags)) {
        setGroupTags(data.tags)
        setSelectedTags(data.tags.map((tag: any) => tag.id))
      } else {
        console.warn("Formato de resposta de tags inesperado:", data)
        setGroupTags([])
        setSelectedTags([])
      }
    } catch (error) {
      console.error("Erro ao carregar tags do grupo:", error)
      setGroupTags([])
      setSelectedTags([])
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "A imagem deve ter no máximo 5MB",
          variant: "destructive",
        })
        return
      }

      // Check file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Tipo de arquivo inválido",
          description: "Por favor, selecione uma imagem",
          variant: "destructive",
        })
        return
      }

      setNewAvatar(file)

      // Create preview
      const reader = new FileReader()
      reader.onload = (event) => {
        setGroupAvatar(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const fetchAvailableUsers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })

      if (!response.ok) {
        throw new Error("Falha ao carregar usuários")
      }

      const data = await response.json()
      
      // Garantir que data é um array antes de chamar filter
      if (!Array.isArray(data)) {
        console.warn("Resposta de usuários não é um array:", data)
        setAvailableUsers([])
        return
      }
      
      // Filtrar para excluir usuários que já estão no grupo
      const currentParticipantIds = group.participants.map((p: any) => p.id)
      const filteredUsers = data.filter((user: any) => !currentParticipantIds.includes(user.id))
      
      setAvailableUsers(filteredUsers)
    } catch (error) {
      console.error("Error fetching users:", error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de usuários",
        variant: "destructive",
      })
      setAvailableUsers([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddMembers = () => {
    setIsAddingMembers(true)
    fetchAvailableUsers()
  }

  const handleUserSelect = (userId: string) => {
    setSelectedUsers((prev: string[]) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId)
      } else {
        return [...prev, userId]
      }
    })
  }

  const handleConfirmAddMembers = async () => {
    if (selectedUsers.length === 0) {
      setIsAddingMembers(false)
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chats/${group.id}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          userIds: selectedUsers,
        }),
      })

      if (!response.ok) {
        throw new Error("Falha ao adicionar membros")
      }

      const updatedGroup = await response.json()

      toast({
        title: "Membros adicionados",
        description: `${selectedUsers.length} membros foram adicionados ao grupo`,
      })

      onGroupUpdate(updatedGroup)
      setIsAddingMembers(false)
      setSelectedUsers([])
    } catch (error) {
      console.error("Error adding members:", error)
      toast({
        title: "Erro",
        description: "Não foi possível adicionar os membros ao grupo",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!groupName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, insira um nome para o grupo",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      let avatarUrl = group.avatar

      // Upload new avatar if selected
      if (newAvatar) {
        const formData = new FormData()
        formData.append("file", newAvatar)
        formData.append("chatId", group.id)

        const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload/chat-avatar`, {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          }
        })

        if (!uploadResponse.ok) {
          throw new Error("Falha ao fazer upload da imagem")
        }

        const uploadData = await uploadResponse.json()
        avatarUrl = uploadData.url
      }

      // Update group settings
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chats/${group.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          name: groupName,
          avatar: avatarUrl,
          settings: groupSettings,
          tags: selectedTags,
        }),
      })

      if (!response.ok) {
        throw new Error("Falha ao atualizar configurações do grupo")
      }

      const updatedGroup = await response.json()

      toast({
        title: "Configurações atualizadas",
        description: "As configurações do grupo foram atualizadas com sucesso",
      })

      onGroupUpdate(updatedGroup)
    } catch (error) {
      console.error("Error updating group settings:", error)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar as configurações do grupo",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleArchiveGroup = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chats/${group.id}/archive`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })

      if (!response.ok) {
        throw new Error("Falha ao arquivar grupo")
      }

      toast({
        title: "Grupo arquivado",
        description: "O grupo foi arquivado com sucesso",
      })

      onClose()
    } catch (error) {
      console.error("Error archiving group:", error)
      toast({
        title: "Erro",
        description: "Não foi possível arquivar o grupo",
        variant: "destructive",
      })
    }
  }

  const handleToggleTag = (tagId: string) => {
    setSelectedTags((prev: string[]) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId)
      } else {
        return [...prev, tagId]
      }
    })
  }

  const handlePromoteToAdmin = async (participantId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chats/${group.id}/promote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          userId: participantId,
        }),
      })

      if (!response.ok) {
        throw new Error("Falha ao promover usuário")
      }

      const updatedGroup = await response.json()

      toast({
        title: "Usuário promovido",
        description: "O usuário foi promovido a administrador",
      })

      onGroupUpdate(updatedGroup)
    } catch (error) {
      console.error("Error promoting user:", error)
      toast({
        title: "Erro",
        description: "Não foi possível promover o usuário",
        variant: "destructive",
      })
    }
  }

  const handleDemoteAdmin = async (participantId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chats/${group.id}/demote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          userId: participantId,
        }),
      })

      if (!response.ok) {
        throw new Error("Falha ao remover privilégios de administrador")
      }

      const updatedGroup = await response.json()

      toast({
        title: "Privilégios removidos",
        description: "Os privilégios de administrador foram removidos",
      })

      onGroupUpdate(updatedGroup)
    } catch (error) {
      console.error("Error demoting admin:", error)
      toast({
        title: "Erro",
        description: "Não foi possível remover privilégios do administrador",
        variant: "destructive",
      })
    }
  }

  const handleRemoveParticipant = async (participantId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chats/${group.id}/members/${participantId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })

      if (!response.ok) {
        throw new Error("Falha ao remover participante")
      }

      const updatedGroup = await response.json()

      toast({
        title: "Participante removido",
        description: "O participante foi removido do grupo",
      })

      onGroupUpdate(updatedGroup)
    } catch (error) {
      console.error("Error removing participant:", error)
      toast({
        title: "Erro",
        description: "Não foi possível remover o participante",
        variant: "destructive",
      })
    }
  }

  const handleToggleSetting = (setting: string, value: boolean) => {
    setGroupSettings((prev: any) => ({
      ...prev,
      [setting]: value,
    }))
  }

  const renderTagBadge = (tag: any) => {
    return (
      <div
        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
        style={{
          backgroundColor: tag.color ? `${tag.color}20` : "#e2e8f0",
          color: tag.color || "#64748b",
        }}
      >
        <span className="truncate max-w-[150px]">{tag.name}</span>
      </div>
    )
  }

  const filteredAvailableUsers = availableUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações do Grupo</DialogTitle>
        </DialogHeader>

        {isAddingMembers ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex">
                <Input
                  placeholder="Buscar usuários..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" className="ml-2">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="border rounded-md">
              <div className="p-2 border-b bg-gray-50 dark:bg-gray-800 flex items-center">
                <UserPlus className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">
                  Usuários ({selectedUsers.length} selecionados)
                </span>
              </div>

              <ScrollArea className="h-60">
                {isLoading ? (
                  <div className="p-4 text-center text-gray-500">Carregando usuários...</div>
                ) : filteredAvailableUsers.length > 0 ? (
                  <div className="p-2 space-y-2">
                    {filteredAvailableUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <Checkbox
                          id={`user-${user.id}`}
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => handleUserSelect(user.id)}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar || "/placeholder.svg?height=32&width=32"} />
                          <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <Label htmlFor={`user-${user.id}`} className="flex-1 cursor-pointer">
                          <div className="font-medium">{user.name}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </Label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    {searchQuery ? "Nenhum usuário encontrado" : "Todos os usuários já estão no grupo"}
                  </div>
                )}
              </ScrollArea>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddingMembers(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmAddMembers} disabled={isLoading || selectedUsers.length === 0}>
                {isLoading ? "Adicionando..." : "Adicionar Selecionados"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">Geral</TabsTrigger>
                <TabsTrigger value="members">Membros</TabsTrigger>
                <TabsTrigger value="tags">Tags</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="mt-4 space-y-4">
                <div className="flex flex-col items-center mb-4">
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      {groupAvatar ? (
                        <AvatarImage src={groupAvatar} />
                      ) : (
                        <AvatarFallback className="bg-green-500">{groupName?.charAt(0) || "G"}</AvatarFallback>
                      )}
                    </Avatar>

                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute bottom-0 right-0 rounded-full bg-primary text-primary-foreground"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="h-4 w-4" />
                    </Button>

                    <Input 
                      ref={fileInputRef} 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleAvatarChange} 
                    />
                  </div>

                  <p className="text-xs text-gray-500 mt-2">Clique no ícone para alterar a foto do grupo</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group-name">Nome do Grupo</Label>
                  <Input
                    id="group-name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Nome do grupo"
                  />
                </div>

                <ScrollArea className="h-[250px] pr-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Permissões</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="admin-add-members">Apenas administradores podem adicionar membros</Label>
                            <p className="text-xs text-gray-500">
                              Somente administradores poderão adicionar novos participantes
                            </p>
                          </div>
                          <Switch
                            id="admin-add-members"
                            checked={groupSettings.onlyAdminsCanAddMembers}
                            onCheckedChange={(checked) => handleToggleSetting("onlyAdminsCanAddMembers", checked)}
                            disabled={!isAdmin}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="admin-change-info">Apenas administradores podem alterar informações</Label>
                            <p className="text-xs text-gray-500">
                              Somente administradores poderão alterar configurações avançadas
                            </p>
                          </div>
                          <Switch
                            id="admin-change-info"
                            checked={groupSettings.onlyAdminsCanChangeInfo}
                            onCheckedChange={(checked) => handleToggleSetting("onlyAdminsCanChangeInfo", checked)}
                            disabled={!isAdmin}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="admin-send-messages">Apenas administradores podem enviar mensagens</Label>
                            <p className="text-xs text-gray-500">Somente administradores poderão enviar mensagens no grupo</p>
                          </div>
                          <Switch
                            id="admin-send-messages"
                            checked={groupSettings.onlyAdminsCanSendMessages}
                            onCheckedChange={(checked) => handleToggleSetting("onlyAdminsCanSendMessages", checked)}
                            disabled={!isAdmin}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Notificações</h3>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="mute-notifications">Silenciar notificações</Label>
                          <p className="text-xs text-gray-500">Você não receberá notificações deste grupo</p>
                        </div>
                        <Switch
                          id="mute-notifications"
                          checked={groupSettings.muteNotifications}
                          onCheckedChange={(checked) => handleToggleSetting("muteNotifications", checked)}
                        />
                      </div>
                    </div>

                    <div className="pt-4">
                      {isAdmin && (
                        <Button variant="destructive" className="w-full flex items-center justify-center">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir Grupo
                        </Button>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="members" className="mt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium">Participantes ({group.participants.length})</h3>
                  <Button 
                    size="sm" 
                    onClick={handleAddMembers}
                    className="flex items-center gap-1"
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Adicionar Participantes
                  </Button>
                </div>

                <ScrollArea className="h-[250px]">
                  <div className="space-y-2">
                    {group.participants.map((participant: any) => (
                      <div 
                        key={participant.id} 
                        className="flex items-center justify-between p-2 border rounded-md group hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={participant.avatar || "/placeholder.svg?height=32&width=32"} />
                            <AvatarFallback>{participant.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{participant.name}</div>
                            {participant.isAdmin && (
                              <div className="text-xs text-primary">Administrador</div>
                            )}
                          </div>
                        </div>

                        {participant.id !== userId && (
                          <div className="flex space-x-1">
                            {isAdmin && (
                              <>
                                {participant.isAdmin ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDemoteAdmin(participant.id)}
                                    title="Remover privilégios de administrador"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Shield className="h-4 w-4 text-gray-500" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handlePromoteToAdmin(participant.id)}
                                    title="Promover a administrador"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Shield className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveParticipant(participant.id)}
                              title="Remover do grupo"
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="tags" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Tags do Grupo</h3>
                  <p className="text-xs text-gray-500">
                    Tags ajudam a categorizar e organizar grupos para facilitar a busca e filtragem
                  </p>
                </div>

                <div className="border rounded-md">
                  <div className="p-2 border-b bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                    <TagIcon className="h-4 w-4 mr-2" />
                    <span className="text-sm font-medium">Tags Disponíveis</span>
                  </div>

                  <ScrollArea className="h-60">
                    <div className="p-3 grid grid-cols-2 gap-3">
                      {Array.isArray(tags) ? tags.map((tag) => (
                        <div
                          key={tag.id}
                          className={`p-3 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                            selectedTags.includes(tag.id) ? "bg-gray-50 dark:bg-gray-800 border-primary" : ""
                          }`}
                          onClick={() => (isAdmin ? handleToggleTag(tag.id) : null)}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex-1 mr-2">{renderTagBadge(tag)}</div>
                            {isAdmin && (
                              <div className="h-5 w-5 rounded-full border flex items-center justify-center bg-white">
                                {selectedTags.includes(tag.id) && <Check className="h-3 w-3 text-primary" />}
                              </div>
                            )}
                          </div>
                          {tag.description && <p className="text-xs text-gray-500 truncate">{tag.description}</p>}
                        </div>
                      )) : <div className="p-4 text-center text-gray-500">Nenhuma tag disponível</div>}
                    </div>
                  </ScrollArea>
                </div>

                {!isAdmin && <p className="text-xs text-gray-500 text-center mt-2">Apenas administradores podem alterar as tags do grupo</p>}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              {isAdmin && (
                <Button onClick={handleSaveSettings} disabled={isLoading}>
                  {isLoading ? "Salvando..." : "Salvar"}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

