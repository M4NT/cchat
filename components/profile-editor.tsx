"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Camera } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ProfileEditorProps {
  user: {
    id: string
    name: string
    email: string
    avatar?: string
  }
  onClose: () => void
  onProfileUpdate: (updatedUser: any) => void
}

export default function ProfileEditor({ user, onClose, onProfileUpdate }: ProfileEditorProps) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [avatar, setAvatar] = useState<string | null>(user.avatar || null)
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
        description: "Por favor, insira um nome válido",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)

    try {
      let avatarUrl = user.avatar

      // Upload new avatar if selected
      if (newAvatar) {
        const formData = new FormData()
        formData.append("file", newAvatar)
        formData.append("userId", user.id)

        console.log("Enviando avatar para atualização...");
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/avatar`, {
          method: "POST",
          body: formData,
        })

        const data = await response.json()

        if (data.url) {
          console.log("Avatar atualizado com sucesso:", data.url);
          avatarUrl = data.url
        }
      }

      // Garantir que a URL do avatar seja absoluta
      if (avatarUrl && !avatarUrl.startsWith('http')) {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || window.location.origin;
        avatarUrl = `${baseUrl}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
        console.log("URL do avatar convertida para absoluta:", avatarUrl);
      }

      // Update user profile
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          name,
          email,
          avatar: avatarUrl,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Criar objeto de usuário atualizado
        const updatedUser = {
          ...user,
          name,
          email,
          avatar: avatarUrl,
        }

        // Update local storage
        localStorage.setItem("chatUser", JSON.stringify(updatedUser))
        
        // Chamar a função de callback com o usuário atualizado
        // Isso vai disparar atualizações de socket no componente pai
        onProfileUpdate(updatedUser)

        toast({
          title: "Perfil atualizado",
          description: "Seu perfil foi atualizado com sucesso",
        })

        // Fechar o editor após atualização bem-sucedida
        onClose()
      } else {
        toast({
          title: "Erro",
          description: data.message || "Erro ao atualizar perfil",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao atualizar o perfil",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-col items-center">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatar || "/placeholder.svg?height=96&width=96"} />
                <AvatarFallback>
                  <User className="h-12 w-12" />
                </AvatarFallback>
              </Avatar>

              <Button
                variant="outline"
                size="icon"
                className="absolute bottom-0 right-0 rounded-full bg-primary text-primary-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
              </Button>

              <Input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            <p className="text-xs text-gray-500 mt-2">Clique no ícone para alterar sua foto de perfil</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu email"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isUploading}>
            {isUploading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

