"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Link as LinkIcon,
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
  const [linkUrl, setLinkUrl] = useState("")
  const [linkTitle, setLinkTitle] = useState("")
  const [isValidatingLink, setIsValidatingLink] = useState(false)
  const [linkPreview, setLinkPreview] = useState<any>(null)
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

      console.log("Tipo de arquivo selecionado:", selectedFile.type)
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
      } else {
        // Para outros tipos de arquivo, apenas mostramos o ícone
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

  const handleLinkSubmit = async () => {
    if (!linkUrl || !chatId || !senderId) return;
    
    setIsUploading(true);
    
    try {
      // Você pode implementar uma API para validar e obter metadados do link
      // (título, descrição, imagem, etc.)
      // Aqui vamos simular que o link foi processado com sucesso
      
      // No mundo real, essa seria uma chamada a uma API que faria um scraping da página
      // e retornaria os metadados
      // const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/validate-link`, {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({ url: linkUrl }),
      // });
      // const data = await response.json();
      
      // Por enquanto, vamos apenas enviar o link como uma mensagem especial
      const linkData = {
        url: linkUrl,
        title: linkTitle || linkUrl,
      };
      
      const linkJson = JSON.stringify(linkData);
      
      onUploadComplete(linkJson, "link", linkTitle || "Link compartilhado");
    } catch (error) {
      console.error("Error processing link:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar o link",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const validateLink = async () => {
    if (!linkUrl) return;
    
    setIsValidatingLink(true);
    
    try {
      // Em um ambiente de produção, você faria uma requisição para obter metadados do link
      // Como título, descrição, imagem de preview, etc.
      // const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/link-preview`, {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({ url: linkUrl }),
      // });
      // const data = await response.json();
      // setLinkPreview(data);
      // if (data.title) setLinkTitle(data.title);
      
      // Por enquanto, apenas validamos se o URL parece válido
      const urlPattern = /^(https?:\/\/)?([\w-]+(\.[\w-]+)+)([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?$/;
      if (urlPattern.test(linkUrl)) {
        // Se o URL não começa com http:// ou https://, adicionamos https://
        let fullUrl = linkUrl;
        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
          fullUrl = 'https://' + fullUrl;
          setLinkUrl(fullUrl);
        }
        
        setLinkPreview({
          url: fullUrl,
          title: linkTitle || fullUrl,
        });
      } else {
        toast({
          title: "URL inválido",
          description: "Por favor, insira um URL válido",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error validating link:", error);
      toast({
        title: "Erro",
        description: "Não foi possível validar o link",
        variant: "destructive",
      });
    } finally {
      setIsValidatingLink(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="h-10 w-10 text-blue-500" />
    if (type.startsWith("video/")) return <FileVideo className="h-10 w-10 text-red-500" />
    if (type.startsWith("audio/")) return <FileAudio className="h-10 w-10 text-green-500" />
    if (type === "application/pdf") return <FilePdf className="h-10 w-10 text-orange-500" />
    if (type.includes("zip") || type.includes("compressed"))
      return <FileArchive className="h-10 w-10 text-purple-500" />
    if (type.includes("document") || type.includes("word") || type.includes("officedocument.wordprocessing"))
      return <FileText className="h-10 w-10 text-blue-600" />
    if (type.includes("spreadsheet") || type.includes("excel") || type.includes("officedocument.spreadsheet"))
      return <FileText className="h-10 w-10 text-green-600" />
    if (type.includes("presentation") || type.includes("powerpoint") || type.includes("officedocument.presentation"))
      return <FileText className="h-10 w-10 text-orange-500" />
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
        <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md mt-4">
          {getFileIcon(file.type)}
          <div className="flex-1">
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

  const renderLinkPreview = () => {
    if (!linkPreview) return null;
    
    return (
      <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md mt-4">
        <LinkIcon className="h-10 w-10 text-blue-500" />
        <div className="flex-1">
          <p className="font-medium">{linkPreview.title || linkPreview.url}</p>
          <p className="text-sm text-gray-500 truncate">{linkPreview.url}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          onClick={() => {
            setLinkPreview(null);
            setLinkUrl("");
            setLinkTitle("");
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Arquivo ou Link</DialogTitle>
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
                  Suporte para documentos (PDF, Word, Excel, PowerPoint), imagens, vídeos, áudios e outros arquivos
                </p>
                <Input 
                  ref={fileInputRef} 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.mp3,.mp4,.zip,.rar"
                />
              </div>
            ) : (
              renderFilePreview()
            )}
          </TabsContent>

          <TabsContent value="link" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="link-url">URL do Link</Label>
                <div className="flex space-x-2">
                  <Input
                    id="link-url"
                    placeholder="https://exemplo.com"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    variant="secondary"
                    onClick={validateLink}
                    disabled={!linkUrl || isValidatingLink}
                  >
                    Validar
                  </Button>
                </div>
              </div>
              
              {linkPreview && (
                <div className="space-y-2">
                  <Label htmlFor="link-title">Título do Link (opcional)</Label>
                  <Input
                    id="link-title"
                    placeholder="Título do link"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                  />
                </div>
              )}
              
              {renderLinkPreview()}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={activeTab === "upload" ? handleUpload : handleLinkSubmit}
            disabled={(activeTab === "upload" ? !file : !linkPreview) || isUploading}
          >
            {isUploading ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

