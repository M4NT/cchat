"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface GroupEditorProps {
  group: {
    id: string
    name: string
    avatar?: string
    isGroup: boolean
    participants: any[]
  }
  userId: string
  onClose: () => void
  onGroupUpdate: (updatedGroup: any) => void
}

export default function GroupEditor({ group, userId, onClose, onGroupUpdate }: GroupEditorProps) {
  const [name, setName] = useState(group.name)
  const [avatar, setAvatar] = useState<string | null>(group.avatar || null)
  const [newAvatar, setNewAvatar] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

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
        setAvatar(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({
        title: "Nome inválido",
        description: "Por favor, insira um nome válido para o grupo",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)

    try {
      let avatarUrl = group.avatar

      // Upload new avatar if selected
      if (newAvatar) {
        const formData = new FormData()
        formData.append("file", newAvatar)
        formData.append("groupId", group.id)

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/groups/avatar`, {
          method: "POST",
          body: formData,
        })

        const data = await response.json()

        if (data.url) {
          avatarUrl = data.url
        }
      }

      // Update group
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/groups/${group.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          name,
          avatar: avatarUrl,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Grupo atualizado",
          description: "O grupo foi atualizado com sucesso",
        })

        const updatedGroup = {
          ...group,
          name,
          avatar: avatarUrl,
        }

        onGroupUpdate(updatedGroup)
      } else {
        toast({
          title: "Erro",
          description: data.message || "Erro ao atualizar grupo",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating group:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao atualizar o grupo",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  // Check if user is admin (for now, we'll consider the creator as admin)
  const isAdmin = group.participants.some((p) => p.id === userId && p.isAdmin)

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Grupo</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-col items-center">
            <div className="relative">
              <Avatar className="h-24 w-24">
                {avatar ? (
                  <AvatarImage src={avatar} />
                ) : (
                  <AvatarFallback className="bg-green-500">{name.charAt(0)}</AvatarFallback>
                )}
              </Avatar>

              {isAdmin && (
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute bottom-0 right-0 rounded-full bg-primary text-primary-foreground"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              )}

              <Input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            {isAdmin && <p className="text-xs text-gray-500 mt-2">Clique no ícone para alterar a foto do grupo</p>}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Grupo</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do grupo"
                disabled={!isAdmin}
              />

              {!isAdmin && (
                <p className="text-xs text-gray-500 mt-1">Apenas administradores podem editar o nome do grupo</p>
              )}
            </div>

            <div>
              <Label>Participantes ({group.participants.length})</Label>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-2">
                {group.participants.map((participant) => (
                  <div key={participant.id} className="flex items-center space-x-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={participant.avatar || "/placeholder.svg?height=24&width=24"} />
                      <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{participant.name}</span>
                    {participant.isAdmin && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Admin</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {isAdmin && (
            <Button onClick={handleSubmit} disabled={isUploading}>
              {isUploading ? "Salvando..." : "Salvar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

