"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

interface CreateGroupProps {
  userId?: string
  onClose: () => void
  onGroupCreated: (groupData: any) => void
}

export default function CreateGroup({ userId, onClose, onGroupCreated }: CreateGroupProps) {
  const [groupName, setGroupName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const [avatarUrl, setAvatarUrl] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true)

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users?q=${searchQuery}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        })
        
        if (!response.ok) {
          throw new Error("Falha ao carregar usuários")
        }

        const data = await response.json()
        console.log("Usuários carregados:", data)
        setUsers(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error("Error fetching users:", error)
        toast({
          title: "Erro",
          description: "Não foi possível carregar a lista de usuários",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [searchQuery])

  const handleUserSelect = (userId: string) => {
    setSelectedUsers((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId)
      } else {
        return [...prev, userId]
      }
    })
  }

  const handleCreateGroup = () => {
    if (!groupName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, insira um nome para o grupo",
        variant: "destructive",
      })
      return
    }

    if (selectedUsers.length === 0) {
      toast({
        title: "Participantes obrigatórios",
        description: "Selecione pelo menos um participante para o grupo",
        variant: "destructive",
      })
      return
    }

    const selectedParticipants = users.filter(user => selectedUsers.includes(user.id))
    
    const groupData = {
      name: groupName.trim(),
      participants: selectedParticipants,
      avatar: avatarUrl
    }

    console.log("Criando grupo com dados:", groupData);
    onGroupCreated(groupData)
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 5MB",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsUploading(true);
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("groupId", "temp"); // Será substituído pelo ID real após a criação
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/groups/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Falha ao enviar avatar");
      }
      
      const data = await response.json();
      console.log("Avatar do grupo carregado:", data);
      setAvatarUrl(data.url);
      
      toast({
        title: "Sucesso",
        description: "Avatar do grupo carregado com sucesso"
      });
    } catch (error) {
      console.error("Erro ao carregar avatar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o avatar",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const filteredUsers = searchQuery
    ? users.filter(
        (user) =>
          user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : users

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Grupo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <Label htmlFor="group-avatar">Avatar do Grupo</Label>
            <div className="relative group">
              <Avatar 
                className="h-20 w-20 cursor-pointer border-2 border-primary hover:border-primary/80 transition-all duration-300" 
                onClick={() => document.getElementById('avatar-input')?.click()}
              >
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} />
                ) : (
                  <AvatarFallback className="bg-white">
                    <Users className="h-8 w-8 text-gray-400" />
                  </AvatarFallback>
                )}
              </Avatar>
              
              <div 
                className="absolute bottom-0 right-0 h-7 w-7 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-md"
                onClick={() => document.getElementById('avatar-input')?.click()}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="12" 
                  height="12" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="text-white"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                </svg>
              </div>
              
              <input 
                type="file" 
                id="avatar-input" 
                className="hidden" 
                accept="image/*" 
                onChange={handleAvatarChange}
                disabled={isUploading}
              />
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                  <div className="animate-spin h-5 w-5 border-2 border-white border-opacity-50 border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
            <span className="text-xs text-gray-500">Clique para selecionar uma imagem</span>
          </div>

          <div>
            <Label htmlFor="group-name">Nome do Grupo</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Digite o nome do grupo"
            />
          </div>

          <div>
            <Label>Adicionar Participantes</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar usuários..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="border rounded-md">
            <div className="p-2 border-b bg-gray-50 dark:bg-gray-800 flex items-center">
              <Users className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">
                Usuários ({selectedUsers.length} selecionados)
              </span>
            </div>

            {isLoading ? (
              <div className="p-4 text-center text-gray-500">Carregando usuários...</div>
            ) : filteredUsers.length > 0 ? (
              <div className="max-h-60 overflow-y-auto p-2 space-y-2">
                {filteredUsers.map((user) => (
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
              <div className="p-4 text-center text-gray-500">Nenhum usuário encontrado</div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCreateGroup} disabled={!groupName.trim() || selectedUsers.length === 0}>
            Criar Grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

