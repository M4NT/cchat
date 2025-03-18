"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { Download, Upload, RefreshCw } from "lucide-react"

interface BackupManagerProps {
  chatId?: string | number
  userId?: string | number
  onClose: () => void
  onBackupComplete?: () => void
}

export default function BackupManager({ chatId, userId, onClose, onBackupComplete }: BackupManagerProps) {
  const [activeTab, setActiveTab] = useState("export")
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleExport = async () => {
    setIsProcessing(true)
    setProgress(0)

    try {
      // Simular progresso
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            return 100
          }
          return prev + 10
        })
      }, 300)

      // Obter dados do chat diretamente (abordagem client-side)
      // Esta é uma implementação simplificada para demonstração
      const chatData = {
        chat: {
          id: chatId || "all",
          exportedAt: new Date().toISOString(),
          exportedBy: userId
        },
        messages: []
      }
      
      // Criar e baixar o arquivo JSON
      const jsonString = JSON.stringify(chatData, null, 2)
      const blob = new Blob([jsonString], { type: "application/json" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.style.display = 'none'
      a.href = url
      a.download = `chat-backup-${chatId || "all"}-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      clearInterval(interval)
      setProgress(100)

      toast({
        title: "Backup concluído",
        description: "O arquivo de backup foi baixado com sucesso",
      })
    } catch (error) {
      console.error("Error exporting chat:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao exportar o chat",
        variant: "destructive",
      })
    } finally {
      setTimeout(() => {
        setIsProcessing(false)
        setProgress(0)
      }, 1000)
    }
  }

  const handleImport = async (file: File) => {
    setIsProcessing(true)
    setProgress(0)

    try {
      // Simular progresso
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            return 100
          }
          return prev + 10
        })
      }, 300)

      // Ler o arquivo JSON
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        try {
          if (!e.target?.result) {
            throw new Error("Falha ao ler o arquivo")
          }
          
          // Parsear o JSON
          const jsonData = JSON.parse(e.target.result as string)
          
          console.log("Dados importados:", jsonData)
          
          // Aqui você implementaria a importação real dos dados
          
          clearInterval(interval)
          setProgress(100)
          
          toast({
            title: "Importação concluída",
            description: "O backup foi importado com sucesso!",
          })
          
          if (onBackupComplete) {
            onBackupComplete()
          }
        } catch (error) {
          console.error("Erro ao processar arquivo:", error)
          toast({
            title: "Erro",
            description: "O arquivo JSON é inválido ou corrompido",
            variant: "destructive",
          })
        } finally {
          setTimeout(() => {
            setIsProcessing(false)
            setProgress(0)
          }, 1000)
        }
      }
      
      reader.onerror = () => {
        clearInterval(interval)
        toast({
          title: "Erro",
          description: "Não foi possível ler o arquivo",
          variant: "destructive",
        })
        setIsProcessing(false)
        setProgress(0)
      }
      
      // Iniciar a leitura do arquivo
      reader.readAsText(file)
    } catch (error) {
      console.error("Error importing chat:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao importar o chat",
        variant: "destructive",
      })
      setIsProcessing(false)
      setProgress(0)
    }
  }

  const handleSync = async () => {
    if (!chatId) {
      toast({
        title: "Erro",
        description: "Selecione um chat para sincronizar",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)

    try {
      // Simulate progress
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            return 100
          }
          return prev + 10
        })
      }, 300)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/backup/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          chatId,
          userId,
        }),
      })

      if (!response.ok) {
        throw new Error("Falha ao sincronizar")
      }

      clearInterval(interval)
      setProgress(100)

      toast({
        title: "Sincronização concluída",
        description: "As mensagens foram sincronizadas com sucesso",
      })

      // Reload page after sync
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      console.error("Error syncing messages:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao sincronizar as mensagens",
        variant: "destructive",
      })
    } finally {
      setTimeout(() => {
        setIsProcessing(false)
        setProgress(0)
      }, 1000)
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciador de Backup</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="export">Exportar</TabsTrigger>
            <TabsTrigger value="import">Importar</TabsTrigger>
            <TabsTrigger value="sync">Sincronizar</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Exportar Conversas</CardTitle>
                <CardDescription>Baixe um backup das suas conversas para armazenamento local</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm">
                    {chatId
                      ? "Você está prestes a exportar esta conversa específica."
                      : "Você está prestes a exportar todas as suas conversas."}
                  </p>

                  {isProcessing && (
                    <div className="space-y-2">
                      <Progress value={progress} />
                      <p className="text-xs text-center text-gray-500">
                        {progress < 100 ? "Preparando arquivo de backup..." : "Backup concluído!"}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleExport} disabled={isProcessing} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar {chatId ? "Conversa" : "Todas as Conversas"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Importar Conversas</CardTitle>
                <CardDescription>Restaure conversas a partir de um arquivo de backup</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm">Selecione um arquivo de backup JSON para importar.</p>

                  <label 
                    htmlFor="import-file" 
                    className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-md p-6 text-center cursor-pointer block"
                  >
                    <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium">Clique para selecionar um arquivo</p>
                    <p className="text-xs text-gray-500 mt-1">Apenas arquivos JSON são suportados</p>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      id="import-file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleImport(e.target.files[0])
                        }
                      }}
                      disabled={isProcessing}
                    />
                  </label>

                  {isProcessing && (
                    <div className="space-y-2">
                      <Progress value={progress} />
                      <p className="text-xs text-center text-gray-500">
                        {progress < 100 ? "Importando conversas..." : "Importação concluída!"}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Selecionar Arquivo
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="sync" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Sincronizar Mensagens</CardTitle>
                <CardDescription>Sincronize mensagens antigas ou perdidas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm">
                    Esta opção irá sincronizar mensagens que podem não ter sido carregadas corretamente.
                  </p>

                  {isProcessing && (
                    <div className="space-y-2">
                      <Progress value={progress} />
                      <p className="text-xs text-center text-gray-500">
                        {progress < 100 ? "Sincronizando mensagens..." : "Sincronização concluída!"}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSync} disabled={isProcessing || !chatId} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronizar Mensagens
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


