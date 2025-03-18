"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserPlus, UserMinus, MessageSquareOff, Settings, Pin, Shield, Clock } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface ActionHistoryProps {
  chatId?: string
  userId: string
  isAdmin: boolean
  onClose: () => void
}

interface ActionLog {
  id: string
  chatId: string
  userId: string
  targetId?: string
  actionType: string
  details?: string
  timestamp: string
  user: {
    name: string
    avatar?: string
  }
  target?: {
    name: string
    avatar?: string
  }
}

export default function ActionHistory({ chatId, userId, isAdmin, onClose }: ActionHistoryProps) {
  const [activeTab, setActiveTab] = useState("group")
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true)

      try {
        const endpoint =
          activeTab === "group" && chatId
            ? `${process.env.NEXT_PUBLIC_API_URL}/api/logs/chat/${chatId}`
            : `${process.env.NEXT_PUBLIC_API_URL}/api/logs/user/${userId}`

        const response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        })

        if (!response.ok) {
          throw new Error("Falha ao carregar histórico")
        }

        const data = await response.json()
        setLogs(data.logs)
      } catch (error) {
        console.error("Error fetching logs:", error)
        setLogs([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchLogs()
  }, [activeTab, chatId, userId])

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "ADD_MEMBER":
        return <UserPlus className="h-4 w-4 text-green-500" />
      case "REMOVE_MEMBER":
        return <UserMinus className="h-4 w-4 text-red-500" />
      case "DELETE_MESSAGE":
        return <MessageSquareOff className="h-4 w-4 text-orange-500" />
      case "UPDATE_GROUP":
        return <Settings className="h-4 w-4 text-blue-500" />
      case "PIN_MESSAGE":
        return <Pin className="h-4 w-4 text-yellow-500" />
      case "CHANGE_ADMIN":
        return <Shield className="h-4 w-4 text-purple-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getActionDescription = (log: ActionLog) => {
    switch (log.actionType) {
      case "ADD_MEMBER":
        return `adicionou ${log.target?.name || "um usuário"} ao grupo`
      case "REMOVE_MEMBER":
        return `removeu ${log.target?.name || "um usuário"} do grupo`
      case "DELETE_MESSAGE":
        return `excluiu uma mensagem ${log.details ? `("${log.details}")` : ""}`
      case "UPDATE_GROUP":
        return `atualizou as informações do grupo ${log.details || ""}`
      case "PIN_MESSAGE":
        return `${log.details?.includes("unpin") ? "desafixou" : "fixou"} uma mensagem`
      case "CHANGE_ADMIN":
        return `${log.details?.includes("add") ? "promoveu" : "rebaixou"} ${log.target?.name || "um usuário"} ${log.details?.includes("add") ? "a administrador" : "de administrador"}`
      default:
        return log.details || "realizou uma ação"
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Histórico de Ações</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="group" disabled={!chatId}>
              Grupo
            </TabsTrigger>
            <TabsTrigger value="user">Pessoal</TabsTrigger>
          </TabsList>

          <TabsContent value="group" className="mt-4">
            <ScrollArea className="h-[300px] pr-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-500">Carregando...</p>
                </div>
              ) : logs.length > 0 ? (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={log.user.avatar || "/placeholder.svg?height=32&width=32"} />
                        <AvatarFallback>{log.user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium">{log.user.name}</p>
                          <span className="flex items-center text-xs text-gray-500">
                            {getActionIcon(log.actionType)}
                            <span className="ml-1">{getActionDescription(log)}</span>
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {format(new Date(log.timestamp), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-500">Nenhuma ação registrada</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="user" className="mt-4">
            <ScrollArea className="h-[300px] pr-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-500">Carregando...</p>
                </div>
              ) : logs.length > 0 ? (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start space-x-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="flex items-center text-xs">
                            {getActionIcon(log.actionType)}
                            <span className="ml-1 font-medium">{log.actionType.replace("_", " ")}</span>
                          </span>
                        </div>
                        <p className="text-sm mt-1">{log.details}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(log.timestamp), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-500">Nenhuma ação registrada</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {isAdmin && activeTab === "group" && (
            <Button
              variant="default"
              onClick={() => {
                // Export logs
                const logsData = JSON.stringify(logs, null, 2)
                const blob = new Blob([logsData], { type: "application/json" })
                const url = URL.createObjectURL(blob)

                const a = document.createElement("a")
                a.href = url
                a.download = `logs-${chatId}-${new Date().toISOString().split("T")[0]}.json`
                document.body.appendChild(a)
                a.click()

                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              }}
            >
              Exportar Logs
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

