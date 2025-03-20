"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { BarChart2, CheckCircle2, Circle, Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

interface PollMessageProps {
  poll: any
  currentUserId: string
  isGroupAdmin: boolean
}

export default function PollMessage({ poll, currentUserId, isGroupAdmin }: PollMessageProps) {
  const [userVote, setUserVote] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [totalVotes, setTotalVotes] = useState(0)
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Inicializar os votos a partir dos dados da enquete
    if (poll) {
      let total = 0
      const counts: Record<string, number> = {}
      
      // Verificar se o usuário já votou
      const userVoteOption = poll.votes?.find((vote: any) => vote.userId === currentUserId)
      if (userVoteOption) {
        setUserVote(userVoteOption.optionId)
        setShowResults(true)
      }
      
      // Contar votos para cada opção
      poll.votes?.forEach((vote: any) => {
        counts[vote.optionId] = (counts[vote.optionId] || 0) + 1
        total++
      })
      
      setVoteCounts(counts)
      setTotalVotes(total)
    }
  }, [poll, currentUserId])

  const handleVote = async () => {
    if (!selectedOption) return
    
    try {
      setIsSubmitting(true)
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/polls/${poll.id}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          optionId: selectedOption,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Falha ao registrar voto")
      }
      
      const updatedPoll = await response.json()
      
      // Atualizar localmente
      setUserVote(selectedOption)
      
      // Atualizar contagens
      let total = 0
      const counts: Record<string, number> = {}
      
      updatedPoll.votes?.forEach((vote: any) => {
        counts[vote.optionId] = (counts[vote.optionId] || 0) + 1
        total++
      })
      
      setVoteCounts(counts)
      setTotalVotes(total)
      setShowResults(true)
      
      toast({
        title: "Voto registrado",
        description: "Seu voto foi registrado com sucesso",
      })
    } catch (error) {
      console.error("Erro ao votar:", error)
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao registrar voto",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculatePercentage = (optionId: string) => {
    if (totalVotes === 0) return 0
    return Math.round((voteCounts[optionId] || 0) * 100 / totalVotes)
  }

  if (!poll) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  const maxDisplayOptions = isExpanded ? poll.options.length : Math.min(4, poll.options.length)
  const hasMoreOptions = !isExpanded && poll.options.length > 4

  return (
    <Card className="w-full max-w-md border border-primary/20 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" />
          <CardTitle className="text-base font-medium text-primary">Enquete</CardTitle>
        </div>
        <CardDescription className="font-medium text-base text-foreground mt-1">
          {poll.question}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-2">
        {poll.options.slice(0, maxDisplayOptions).map((option: any) => (
          <div 
            key={option.id} 
            className={`
              rounded-md p-2 transition-all
              ${showResults 
                ? 'bg-muted' 
                : userVote 
                  ? 'bg-muted cursor-not-allowed' 
                  : 'hover:bg-muted/80 cursor-pointer'
              }
              ${selectedOption === option.id ? 'ring-1 ring-primary bg-primary/5' : ''}
              ${userVote === option.id ? 'ring-1 ring-primary bg-primary/10' : ''}
            `}
            onClick={() => {
              if (!userVote && !isSubmitting) {
                setSelectedOption(option.id)
              }
            }}
          >
            <div className="flex items-center gap-2">
              {showResults ? (
                <div className="flex items-center justify-center w-5 h-5">
                  {userVote === option.id ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              ) : (
                <div 
                  className={`flex items-center justify-center w-5 h-5 rounded-full border
                    ${selectedOption === option.id 
                      ? 'border-primary bg-primary/20' 
                      : 'border-muted-foreground'
                    }
                  `}
                >
                  {selectedOption === option.id && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
              )}
              
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{option.text}</span>
                  {showResults && (
                    <span className="text-xs font-medium">
                      {calculatePercentage(option.id)}%
                    </span>
                  )}
                </div>
                
                {showResults && (
                  <div className="mt-1">
                    <Progress 
                      value={calculatePercentage(option.id)} 
                      className="h-1" 
                    />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {voteCounts[option.id] || 0} voto{(voteCounts[option.id] || 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {hasMoreOptions && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-xs" 
            onClick={() => setIsExpanded(true)}
          >
            Ver mais {poll.options.length - maxDisplayOptions} opções
          </Button>
        )}
      </CardContent>
      
      <CardFooter className="flex flex-col gap-2 pt-0">
        <div className="w-full flex justify-between items-center text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Info className="h-3 w-3" />
            <span>Total: {totalVotes} voto{totalVotes !== 1 ? 's' : ''}</span>
          </div>
          
          {!showResults && !userVote && (
            <Button 
              size="sm" 
              disabled={!selectedOption || isSubmitting}
              onClick={handleVote}
            >
              Votar
            </Button>
          )}
          
          {isGroupAdmin && (
            <Button variant="outline" size="sm">
              Ver detalhes
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
} 