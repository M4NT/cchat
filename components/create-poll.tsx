import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Plus, Minus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CreatePollProps {
  chatId: string
  onClose: () => void
  onPollCreate: (pollData: any) => void
}

export default function CreatePoll({ chatId, onClose, onPollCreate }: CreatePollProps) {
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""])
    } else {
      toast({
        title: "Limite atingido",
        description: "Você pode adicionar no máximo 10 opções",
        variant: "destructive",
      })
    }
  }

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = [...options]
      newOptions.splice(index, 1)
      setOptions(newOptions)
    } else {
      toast({
        title: "Erro",
        description: "A enquete precisa ter pelo menos 2 opções",
        variant: "destructive",
      })
    }
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const handleCreatePoll = async () => {
    // Validate inputs
    if (!question.trim()) {
      toast({
        title: "Erro",
        description: "Digite uma pergunta para a enquete",
        variant: "destructive",
      })
      return
    }

    const validOptions = options.filter((opt) => opt.trim())
    if (validOptions.length < 2) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos 2 opções válidas",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)

    try {
      const pollData = {
        chatId,
        question: question.trim(),
        options: validOptions.map((text) => ({
          text: text.trim(),
          votes: 0,
        })),
        totalVotes: 0,
      }

      onPollCreate(pollData)
      onClose()
    } catch (error) {
      console.error("Error creating poll:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao criar a enquete",
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

        <div className="space-y-4">
          <div>
            <Input
              placeholder="Digite a pergunta da enquete..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="mb-2"
            />
          </div>

          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  placeholder={`Opção ${index + 1}`}
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                />
                {options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveOption(index)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleAddOption}
            disabled={options.length >= 10}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar opção
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCreatePoll} disabled={isCreating}>
            {isCreating ? "Criando..." : "Criar enquete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 