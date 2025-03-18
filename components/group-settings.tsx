"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Shield, TagIcon, Archive, Trash2, UserPlus, UserMinus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface GroupSettingsProps {
  group: {
    id: string
    name: string
    avatar?: string
    isGroup: boolean
    participants: any[]
    settings?: any
  }
  userId: string
  isAdmin: boolean
  tags: any[]
  onClose: () => void
  onGroupUpdate: (updatedGroup: any) => void
}

export default function GroupSettings({ group, userId, isAdmin, tags, onClose, onGroupUpdate }: GroupSettingsProps) {
  const [activeTab, setActiveTab] = useState("general")
  const [groupName, setGroupName] = useState(group.name)
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
        throw new Error("Falha ao carregar tags do grupo")
      }

      const data = await response.json()
      setGroupTags(data.tags)
      setSelectedTags(data.tags.map((tag: any) => tag.id))
    } catch (error) {
      console.error("Error fetching group tags:", error)
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
      // Update group settings
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chats/${group.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          name: groupName,
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
    setSelectedTags((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId)
      } else {
        return [...prev, tagId]
      }
    })
  }

  const handleToggleSetting = (setting: string, value: boolean) => {
    setGroupSettings((prev) => ({
      ...prev,
      [setting]: value,
    }))
  }

  const handleRemoveParticipant = async (participantId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chats/${group.id}/participants/${participantId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error("Falha ao remover participante")
      }

      toast({
        title: "Participante removido",
        description: "O participante foi removido do grupo com sucesso",
      })

      // Update participants list
      const updatedGroup = {
        ...group,
        participants: group.participants.filter((p) => p.id !== participantId),
      }

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

  const handlePromoteToAdmin = async (participantId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chats/${group.id}/participants/${participantId}/promote`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error("Falha ao promover participante")
      }

      toast({
        title: "Participante promovido",
        description: "O participante foi promovido a administrador com sucesso",
      })

      // Update participants list
      const updatedGroup = {
        ...group,
        participants: group.participants.map((p) => (p.id === participantId ? { ...p, isAdmin: true } : p)),
      }

      onGroupUpdate(updatedGroup)
    } catch (error) {
      console.error("Error promoting participant:", error)
      toast({
        title: "Erro",
        description: "Não foi possível promover o participante",
        variant: "destructive",
      })
    }
  }

  const handleDemoteAdmin = async (participantId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chats/${group.id}/participants/${participantId}/demote`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error("Falha ao rebaixar administrador")
      }

      toast({
        title: "Administrador rebaixado",
        description: "O administrador foi rebaixado com sucesso",
      })

      // Update participants list
      const updatedGroup = {
        ...group,
        participants: group.participants.map((p) => (p.id === participantId ? { ...p, isAdmin: false } : p)),
      }

      onGroupUpdate(updatedGroup)
    } catch (error) {
      console.error("Error demoting admin:", error)
      toast({
        title: "Erro",
        description: "Não foi possível rebaixar o administrador",
        variant: "destructive",
      })
    }
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
          <DialogTitle>Configurações do Grupo</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="members">Membros</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Nome do Grupo</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nome do grupo"
                disabled={!isAdmin && groupSettings.onlyAdminsCanChangeInfo}
              />
              {!isAdmin && groupSettings.onlyAdminsCanChangeInfo && (
                <p className="text-xs text-gray-500">Apenas administradores podem alterar o nome do grupo</p>
              )}
            </div>

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
                      Somente administradores poderão alterar nome, avatar e configurações
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

            <div className="pt-4 space-y-2">
              <Button
                variant="outline"
                className="w-full flex items-center justify-center"
                onClick={handleArchiveGroup}
              >
                <Archive className="h-4 w-4 mr-2" />
                Arquivar Grupo
              </Button>

              {isAdmin && (
                <Button variant="destructive" className="w-full flex items-center justify-center">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Grupo
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="members" className="mt-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Participantes ({group.participants.length})</h3>
              {isAdmin && !groupSettings.onlyAdminsCanAddMembers && (
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              )}
            </div>

            <ScrollArea className="h-60">
              <div className="space-y-2">
                {group.participants.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between p-2 border rounded-md">
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={participant.avatar || "/placeholder.svg?height=32&width=32"} />
                        <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{participant.name}</p>
                        <p className="text-xs text-gray-500">{participant.email}</p>
                      </div>
                      {participant.isAdmin && (
                        <Badge variant="outline" className="ml-2">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                    </div>

                    {isAdmin && participant.id !== userId && (
                      <div className="flex space-x-1">
                        {participant.isAdmin ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDemoteAdmin(participant.id)}
                            title="Remover privilégios de administrador"
                          >
                            <Shield className="h-4 w-4 text-gray-500" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePromoteToAdmin(participant.id)}
                            title="Promover a administrador"
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveParticipant(participant.id)}
                          title="Remover do grupo"
                        >
                          <UserMinus className="h-4 w-4 text-destructive" />
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
              <div className="p-2 border-b bg-gray-50 dark:bg-gray-800 flex items-center">
                <TagIcon className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Tags Disponíveis</span>
              </div>

              <ScrollArea className="h-60">
                <div className="p-2 grid grid-cols-2 gap-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className={`p-2 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                        selectedTags.includes(tag.id) ? "bg-gray-50 dark:bg-gray-800 border-primary" : ""
                      }`}
                      onClick={() => (isAdmin ? handleToggleTag(tag.id) : null)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        {renderTagBadge(tag)}
                        {isAdmin && (
                          <div className="h-4 w-4 rounded-full border flex items-center justify-center">
                            {selectedTags.includes(tag.id) && <Check className="h-3 w-3" />}
                          </div>
                        )}
                      </div>
                      {tag.description && <p className="text-xs text-gray-500 truncate">{tag.description}</p>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {!isAdmin && <p className="text-xs text-gray-500">Apenas administradores podem alterar as tags do grupo</p>}
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
      </DialogContent>
    </Dialog>
  )
}

import { Check } from "lucide-react"

