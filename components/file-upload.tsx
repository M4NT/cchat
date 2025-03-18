"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Upload,
  X,
  ImageIcon,
  FileText,
  File,
  FileArchive,
  FileAudio,
  FileVideo,
  FileIcon as FilePdf,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FileUploadProps {
  chatId?: string
  senderId?: string
  onClose: () => void
  onUploadComplete: (fileUrl: string, fileType: string, fileName: string) => void
}

export default function FileUpload({ chatId, senderId, onClose, onUploadComplete }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [activeTab, setActiveTab] = useState("upload")
  const [fileType, setFileType] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]

      // Check file size (max 20MB)
      if (selectedFile.size > 20 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O tamanho máximo permitido é 20MB",
          variant: "destructive",
        })
        return
      }

      setFile(selectedFile)
      setFileType(selectedFile.type)

      // Create preview for supported file types
      if (selectedFile.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setPreview(event.target?.result as string)
        }
        reader.readAsDataURL(selectedFile)
      } else if (selectedFile.type.startsWith("video/")) {
        const videoUrl = URL.createObjectURL(selectedFile)
        setPreview(videoUrl)
      } else if (selectedFile.type === "application/pdf") {
        // For PDFs, we could use a PDF.js preview, but for simplicity we'll just show an icon
        setPreview(null)
      } else {
        setPreview(null)
      }
    }
  }

  const handleUpload = async () => {
    if (!file || !chatId || !senderId) return

    setIsUploading(true)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("chatId", chatId)
    formData.append("senderId", senderId)
    formData.append("fileName", file.name)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload/file`, {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (data.url) {
        onUploadComplete(data.url, file.type, file.name)
      }
    } catch (error) {
      console.error("Error uploading file:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao enviar o arquivo",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="h-10 w-10 text-blue-500" />
    if (type.startsWith("video/")) return <FileVideo className="h-10 w-10 text-red-500" />
    if (type.startsWith("audio/")) return <FileAudio className="h-10 w-10 text-green-500" />
    if (type === "application/pdf") return <FilePdf className="h-10 w-10 text-orange-500" />
    if (type.includes("zip") || type.includes("compressed"))
      return <FileArchive className="h-10 w-10 text-purple-500" />
    if (type.includes("document") || type.includes("word")) return <FileText className="h-10 w-10 text-blue-500" />
    return <File className="h-10 w-10 text-gray-500" />
  }

  const renderFilePreview = () => {
    if (!file) return null

    if (file.type.startsWith("image/") && preview) {
      return (
        <div className="relative mt-4">
          <img src={preview || "/placeholder.svg"} alt="Preview" className="max-h-64 max-w-full rounded-md" />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={() => {
              setFile(null)
              setPreview(null)
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )
    } else if (file.type.startsWith("video/") && preview) {
      return (
        <div className="relative mt-4">
          <video src={preview} controls className="max-h-64 max-w-full rounded-md" />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={() => {
              setFile(null)
              setPreview(null)
              URL.revokeObjectURL(preview)
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )
    } else {
      return (
        <div className="flex items-center space-x-3 p-4 bg-gray-100 dark:bg-gray-800 rounded-md mt-4">
          {getFileIcon(file.type)}
          <div>
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            onClick={() => {
              setFile(null)
              setPreview(null)
              if (preview && file.type.startsWith("video/")) {
                URL.revokeObjectURL(preview)
              }
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Arquivo</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="link">Link</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 mt-4">
            {!file ? (
              <div
                className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-md p-6 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium">Clique para enviar ou arraste e solte</p>
                <p className="text-xs text-gray-500 mt-1">
                  Suporte para imagens, vídeos, áudios, PDFs e outros arquivos
                </p>
                <Input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
              </div>
            ) : (
              renderFilePreview()
            )}
          </TabsContent>

          <TabsContent value="link" className="space-y-4 mt-4">
            <div className="space-y-2">
              <p className="text-sm">Cole o link do arquivo:</p>
              <Input
                placeholder="https://exemplo.com/arquivo.pdf"
                onChange={(e) => {
                  // Handle link input
                  // This would typically validate the URL and possibly fetch metadata
                }}
              />
              <p className="text-xs text-gray-500">Links para imagens, vídeos e documentos são suportados</p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={activeTab === "upload" ? handleUpload : () => {}}
            disabled={activeTab === "upload" ? !file || isUploading : false}
          >
            {isUploading ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

