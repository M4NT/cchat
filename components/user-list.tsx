"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

interface User {
  id: string
  name: string
  email: string
  avatar?: string
  is_online: boolean
  last_seen?: string
}

interface UserListProps {
  currentUserId: string
  onUserSelect: (user: User) => void
}

export default function UserList({ currentUserId, onUserSelect }: UserListProps) {
  const [users, setUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          // Filtra o usuário atual da lista, garantindo que a comparação seja feita com strings
          const filteredUsers = data.users.filter((user: User) => String(user.id) !== String(currentUserId))
          setUsers(filteredUsers)
        }
      } catch (error) {
        console.error("Erro ao buscar usuários:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [currentUserId])

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar usuários..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <ScrollArea className="h-[calc(100vh-220px)]">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-gray-500">Carregando usuários...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-gray-500">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => onUserSelect(user)}
              >
                <Avatar>
                  <AvatarImage src={user.avatar || "/placeholder.svg?height=32&width=32"} />
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <div className="ml-auto">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      user.is_online ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
} 