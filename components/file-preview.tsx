"use client"

import { Download, FileText, FileImage, FileArchive, FileCode, File, FileVideo, FileAudio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FilePreviewProps {
  fileName: string
  fileUrl: string
  className?: string
  fileSize?: number
}

// Função para obter o ícone baseado na extensão do arquivo
const getFileIcon = (extension: string) => {
  switch (extension.toLowerCase()) {
    case "pdf":
      return <FileText className="h-10 w-10 text-red-500" />
    case "doc":
    case "docx":
      return <FileText className="h-10 w-10 text-blue-600" />
    case "xls":
    case "xlsx":
      return <FileText className="h-10 w-10 text-green-600" />
    case "ppt":
    case "pptx":
      return <FileText className="h-10 w-10 text-orange-500" />
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
      return <FileImage className="h-10 w-10 text-purple-500" />
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      return <FileArchive className="h-10 w-10 text-yellow-500" />
    case "mp4":
    case "avi":
    case "mov":
    case "wmv":
    case "webm":
      return <FileVideo className="h-10 w-10 text-pink-500" />
    case "mp3":
    case "wav":
    case "ogg":
    case "m4a":
      return <FileAudio className="h-10 w-10 text-green-500" />
    case "js":
    case "ts":
    case "html":
    case "css":
    case "jsx":
    case "tsx":
    case "json":
    case "xml":
      return <FileCode className="h-10 w-10 text-gray-500" />
    default:
      return <File className="h-10 w-10 text-gray-500" />
  }
}

// Função para formatar o tamanho do arquivo
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "";
  
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Função para obter o tipo de arquivo em português
const getFileType = (extension: string): string => {
  switch (extension.toLowerCase()) {
    case "pdf":
      return "Documento PDF";
    case "doc":
    case "docx":
      return "Documento Word";
    case "xls":
    case "xlsx":
      return "Planilha Excel";
    case "ppt":
    case "pptx":
      return "Apresentação PowerPoint";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
      return "Imagem";
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      return "Arquivo Compactado";
    case "mp4":
    case "avi":
    case "mov":
    case "wmv":
    case "webm":
      return "Vídeo";
    case "mp3":
    case "wav":
    case "ogg":
    case "m4a":
      return "Áudio";
    case "js":
    case "ts":
    case "html":
    case "css":
    case "jsx":
    case "tsx":
    case "json":
    case "xml":
      return "Código";
    default:
      return "Arquivo";
  }
}

export default function FilePreview({ fileName, fileUrl, fileSize, className }: FilePreviewProps) {
  const fileExtension = fileName.split('.').pop() || '';
  
  return (
    <div className={cn("p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors", className)}>
      <div className="flex items-center space-x-3">
        {getFileIcon(fileExtension)}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{fileName}</p>
          <div className="flex items-center text-xs text-gray-500">
            <span className="mr-2">{getFileType(fileExtension)}</span>
            {fileSize && <span>• {formatFileSize(fileSize)}</span>}
          </div>
        </div>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => window.open(fileUrl, "_blank")}
          title="Baixar arquivo"
          className="flex-shrink-0 text-black dark:text-white"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
} 