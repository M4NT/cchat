"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlusCircle, Trash2, BarChart2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PollCreatorProps {
  chatId: string
  userId: string
  onClose: () => void
  onPollCreate: (pollData: any) => void
}

export default function PollCreator({ chatId, userId, onClose, onPollCreate }: PollCreatorProps) {
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()

  const handleAddOption = () => {
    if (options.length >= 10) {
      toast({
        title: "Limite atingido",
        description: "Você pode adicionar no máximo 10 opções",
        variant: "destructive",
      })
      return
    }

    setOptions([...options, ""])
  }

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      toast({
        title: "Mínimo de opções",
        description: "Uma enquete precisa ter pelo menos 2 opções",
        variant: "destructive",
      })
      return
    }

    const newOptions = [...options]
    newOptions.splice(index, 1)
    setOptions(newOptions)
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const handleCreatePoll = () => {
    // Validate inputs
    if (!question.trim()) {
      toast({
        title: "Pergunta obrigatória",
        description: "Por favor, insira uma pergunta para a enquete",
        variant: "destructive",
      })
      return
    }

    const validOptions = options.filter((option) => option.trim() !== "")
    if (validOptions.length < 2) {
      toast({
        title: "Opções insuficientes",
        description: "Por favor, insira pelo menos 2 opções válidas",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)

    // Create poll data
    const pollData = {
      chatId,
      senderId: userId,
      question,
      options: validOptions.map((text, index) => ({
        id: `option-${index}`,
        text,
        votes: 0,
      })),
      totalVotes: 0,
    }

    // Call the onPollCreate callback
    onPollCreate(pollData)

    // Close the dialog
    onClose()
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Enquete</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="question">Pergunta</Label>
            <Input
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Digite sua pergunta..."
            />
          </div>

          <div className="space-y-2">
            <Label>Opções</Label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Opção ${index + 1}`}
                  />
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveOption(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}

              <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleAddOption}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Adicionar Opção
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCreatePoll} disabled={isCreating}>
            <BarChart2 className="h-4 w-4 mr-2" />
            Criar Enquete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

