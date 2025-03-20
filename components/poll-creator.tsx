"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Trash2, CircleX } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface PollOption {
  id: string
  text: string
}

interface PollCreatorProps {
  chatId: string
  onClose: () => void
  onPollCreated: (poll: Poll) => void
}

interface Poll {
  question: string
  options: PollOption[]
  chatId: string
  expiresAt?: Date
}

export default function PollCreator({ chatId, onClose, onPollCreated }: PollCreatorProps) {
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState<PollOption[]>([
    { id: "1", text: "" },
    { id: "2", text: "" },
  ])
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()

  const addOption = () => {
    if (options.length >= 12) {
      toast({
        title: "Limite excedido",
        description: "Uma enquete pode ter no máximo 12 opções",
        variant: "destructive"
      })
      return
    }
    
    const newId = (options.length + 1).toString()
    setOptions([...options, { id: newId, text: "" }])
  }

  const removeOption = (idToRemove: string) => {
    if (options.length <= 2) {
      toast({
        title: "Mínimo de opções",
        description: "Uma enquete deve ter pelo menos 2 opções",
        variant: "destructive"
      })
      return
    }
    
    setOptions(options.filter(option => option.id !== idToRemove))
  }

  const updateOption = (id: string, newText: string) => {
    setOptions(
      options.map(option => 
        option.id === id ? { ...option, text: newText } : option
      )
    )
  }

  const handleCreatePoll = async () => {
    // Validar campos
    if (!question.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, digite uma pergunta para a enquete",
        variant: "destructive"
      })
      return
    }

    // Verificar se todas as opções têm texto
    const emptyOptions = options.filter(option => !option.text.trim())
    if (emptyOptions.length > 0) {
      toast({
        title: "Campos vazios",
        description: `${emptyOptions.length} opções estão vazias. Preencha todas as opções ou remova as desnecessárias.`,
        variant: "destructive"
      })
      return
    }

    // Verificar se há opções duplicadas
    const optionTexts = options.map(opt => opt.text.trim())
    const uniqueTexts = new Set(optionTexts)
    if (uniqueTexts.size !== optionTexts.length) {
      toast({
        title: "Opções duplicadas",
        description: "Existem opções com o mesmo texto. Todas as opções devem ser únicas.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsCreating(true)
      
      const poll: Poll = {
        question: question.trim(),
        options: options.map(opt => ({ id: opt.id, text: opt.text.trim() })),
        chatId
      }
      
      // Enviar para o backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/polls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(poll),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Falha ao criar enquete")
      }
      
      const createdPoll = await response.json()
      
      toast({
        title: "Enquete criada",
        description: "Sua enquete foi criada com sucesso!",
      })
      
      onPollCreated(createdPoll)
      onClose()
    } catch (error) {
      console.error("Erro ao criar enquete:", error)
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao criar enquete",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Enquete</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="question">Pergunta</Label>
            <Input
              id="question"
              placeholder="Digite sua pergunta..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Opções</Label>
              <span className="text-xs text-muted-foreground">{options.length}/12 opções</span>
            </div>
            
            <ScrollArea className="max-h-[200px] pr-4">
              <div className="space-y-2">
                {options.map((option) => (
                  <div key={option.id} className="flex items-center space-x-2">
                    <Input
                      placeholder={`Opção ${option.id}...`}
                      value={option.text}
                      onChange={(e) => updateOption(option.id, e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(option.id)}
                      disabled={options.length <= 2}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={addOption}
              disabled={options.length >= 12}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar opção
            </Button>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            type="button" 
            onClick={handleCreatePoll}
            disabled={isCreating}
          >
            {isCreating ? "Criando..." : "Criar Enquete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

