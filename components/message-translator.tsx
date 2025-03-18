"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Globe } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface MessageTranslatorProps {
  message: {
    id: string
    content: string
    type: string
  }
  onClose: () => void
  onTranslate?: (messageId: string, translatedText: string) => void
}

const LANGUAGES = [
  { code: "en", name: "Inglês" },
  { code: "es", name: "Espanhol" },
  { code: "fr", name: "Francês" },
  { code: "de", name: "Alemão" },
  { code: "it", name: "Italiano" },
  { code: "ja", name: "Japonês" },
  { code: "ko", name: "Coreano" },
  { code: "zh", name: "Chinês" },
  { code: "ru", name: "Russo" },
  { code: "ar", name: "Árabe" },
  { code: "hi", name: "Hindi" },
  { code: "pt", name: "Português" },
]

export default function MessageTranslator({ message, onClose, onTranslate }: MessageTranslatorProps) {
  const [targetLanguage, setTargetLanguage] = useState("en")
  const [translatedText, setTranslatedText] = useState("")
  const [isTranslating, setIsTranslating] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState("")
  const { toast } = useToast()

  const handleTranslate = async () => {
    if (message.type !== "text") {
      toast({
        title: "Não suportado",
        description: "Apenas mensagens de texto podem ser traduzidas",
        variant: "destructive",
      })
      return
    }

    setIsTranslating(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          text: message.content,
          targetLanguage,
        }),
      })

      if (!response.ok) {
        throw new Error("Falha ao traduzir mensagem")
      }

      const data = await response.json()

      setTranslatedText(data.translatedText)
      setDetectedLanguage(data.detectedLanguage || "Desconhecido")

      if (onTranslate) {
        onTranslate(message.id, data.translatedText)
      }
    } catch (error) {
      console.error("Error translating message:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao traduzir a mensagem",
        variant: "destructive",
      })
    } finally {
      setIsTranslating(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Traduzir Mensagem</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Mensagem original:</p>
            <ScrollArea className="h-20 w-full rounded-md border p-2">
              <p className="text-sm">{message.content}</p>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Traduzir para:</p>
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um idioma" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((language) => (
                  <SelectItem key={language.code} value={language.code}>
                    {language.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {translatedText && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Tradução:</p>
                {detectedLanguage && (
                  <p className="text-xs text-gray-500 flex items-center">
                    <Globe className="h-3 w-3 mr-1" />
                    Detectado: {LANGUAGES.find((l) => l.code === detectedLanguage)?.name || detectedLanguage}
                  </p>
                )}
              </div>
              <ScrollArea className="h-20 w-full rounded-md border p-2 bg-muted/50">
                <p className="text-sm">{translatedText}</p>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={handleTranslate} disabled={isTranslating}>
            {isTranslating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Traduzindo...
              </>
            ) : (
              "Traduzir"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

