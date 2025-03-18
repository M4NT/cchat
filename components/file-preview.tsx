"use client"

import { Download, FileText, FileImage, FileArchive, FileCode, File } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FilePreviewProps {
  fileName: string
  fileUrl: string
  className?: string
}

// Função para obter o ícone baseado na extensão do arquivo
const getFileIcon = (extension: string) => {
  switch (extension.toLowerCase()) {
    case "pdf":
      return <FileText className="h-10 w-10 text-red-500" />
    case "doc":
    case "docx":
      return <FileText className="h-10 w-10 text-blue-500" />
    case "xls":
    case "xlsx":
      return <FileText className="h-10 w-10 text-green-500" />
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
      return <FileImage className="h-10 w-10 text-purple-500" />
    case "zip":
    case "rar":
      return <FileArchive className="h-10 w-10 text-yellow-500" />
    case "js":
    case "ts":
    case "html":
    case "css":
    case "jsx":
    case "tsx":
      return <FileCode className="h-10 w-10 text-gray-500" />
    default:
      return <File className="h-10 w-10 text-gray-500" />
  }
}

export default function FilePreview({ fileName, fileUrl, className }: FilePreviewProps) {
  const fileExtension = fileName.split('.').pop() || ''
  
  return (
    <div className={cn("p-3 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors", className)}>
      <div className="flex items-center space-x-3">
        {getFileIcon(fileExtension)}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName}</p>
          <p className="text-xs text-gray-500">Arquivo</p>
        </div>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => window.open(fileUrl, "_blank")}
          title="Baixar arquivo"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
} 