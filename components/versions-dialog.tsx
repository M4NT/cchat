"use client"

import * as React from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Info, Tag } from "lucide-react"

export type Version = {
  version: string
  date: string
  changes: string[]
}

const versions: Version[] = [
  {
    version: "1.5.1",
    date: "20/03/2025",
    changes: [
      "Correção no upload de arquivos e documentos",
      "Tratamento de erros aprimorado para arquivos e imagens",
      "Correção no carregamento de áudio para evitar erros no console",
      "Melhorias na estabilidade geral do sistema",
      "Correções de bugs no tratamento de tipos de arquivos"
    ]
  },
  {
    version: "1.5.0",
    date: "19/03/2025",
    changes: [
      "Implementação completa da funcionalidade de grupos",
      "Atualização de participantes no grupo: adição e remoção",
      "Proteção para administradores: não é possível remover um administrador",
      "Sistema de promoção automática: quando o último administrador sai, outro membro é promovido",
      "Histórico de versões implementado",
      "Feedback visual aprimorado ao remover ou sair de grupos"
    ]
  },
  {
    version: "1.4.9",
    date: "17/03/2025",
    changes: [
      "Correção de erros na edição de grupo",
      "Correção de layout e organização",
      "Design padronizado entre tabs de conversas e grupos"
    ]
  },
  {
    version: "1.4.8",
    date: "16/03/2025",
    changes: [
      "Correções de bugs diversos",
      "Correções da aba de usuário",
      "Correção de erro sempre aparente",
      "Tentativa de correção de upload de links"
    ]
  },
  {
    version: "1.4.7",
    date: "15/03/2025",
    changes: [
      "Cor alterada do ícone de download para melhor visibilidade",
      "Correção de layout de mensagens",
      "Correção de upload de arquivos"
    ]
  },
  {
    version: "1.4.6",
    date: "14/03/2025",
    changes: [
      "Efeitos sonoros para notificação e envio de mensagens",
      "Ajuste de layout de áudio",
      "Correção de envio de áudio",
      "Correção de cronômetro de áudio",
      "Correção de botões de gravar áudio"
    ]
  },
  {
    version: "1.4.5",
    date: "13/03/2025",
    changes: [
      "Correção de layout da caixa de enviar mensagem",
      "Algumas melhorias no design",
      "Correções de bugs"
    ]
  },
  {
    version: "1.4.0",
    date: "12/03/2025",
    changes: [
      "Mudanças na UI para mobile",
      "Responsividade aprimorada",
      "Suporte a diferentes tamanhos de tela"
    ]
  },
  {
    version: "1.3.0",
    date: "11/03/2025",
    changes: [
      "Alterado recursos para que outros usuários conectem",
      "Adicionado o CORS no projeto",
      "Suporte a conexões externas"
    ]
  },
  {
    version: "1.0.0",
    date: "05/03/2025",
    changes: [
      "Adicionar projeto para produção",
      "Initial commit",
      "Sistema de chat básico implementado",
      "Suporte a mensagens de texto"
    ]
  }
]

export function VersionsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-1">
          <Tag className="h-4 w-4" />
          <span>v{versions[0].version}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Notas de atualização
          </DialogTitle>
          <DialogDescription>
            Histórico de atualizações do sistema de chat
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[50vh] pr-4">
          <div className="space-y-8">
            {versions.map((version) => (
              <div key={version.version} className="relative pl-4 border-l-2 border-gray-200 dark:border-gray-800">
                <div className="absolute -left-[6px] top-0 h-3 w-3 rounded-full bg-primary"></div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-semibold">v{version.version}</h3>
                  <span className="text-sm text-muted-foreground">{version.date}</span>
                </div>
                <ul className="space-y-2 list-disc pl-5">
                  {version.changes.map((change, index) => (
                    <li key={index} className="text-sm">{change}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
} 