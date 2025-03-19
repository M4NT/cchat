"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Send, Paperclip, Mic, Calendar, AtSign } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface MessageInputProps {
  chatId?: string
  participants?: any[]
  onSendMessage: (content: string) => void
  onAttachmentClick: () => void
  onRecordClick: () => void
  onScheduleClick: () => void
  replyingTo?: any
  placeholder?: string
  isGroup?: boolean
  value?: string
  onChange?: (value: string) => void
}

export default function MessageInput({
  chatId,
  participants = [],
  onSendMessage,
  onAttachmentClick,
  onRecordClick,
  onScheduleClick,
  replyingTo,
  placeholder = "Digite uma mensagem...",
  isGroup = false,
  value,
  onChange,
}: MessageInputProps) {
  const [message, setMessage] = useState(value || "")
  const [showEmoji, setShowEmoji] = useState(false)
  const [showMentions, setShowMentions] = useState(false)
  const [filteredParticipants, setFilteredParticipants] = useState<any[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync with external value if provided
  useEffect(() => {
    if (value !== undefined) {
      setMessage(value)
    }
  }, [value])

  const handleSendMessage = () => {
    if (message.trim()) {
      onSendMessage(message)
      setMessage("")
      // Update external state if onChange is provided
      if (onChange) {
        onChange("")
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }

    if (e.key === "@" && isGroup) {
      setShowMentions(true)
      setFilteredParticipants(participants)
    }
  }

  const handleMentionSelect = (participant: any) => {
    const currentInput = inputRef.current
    if (!currentInput) return

    const cursorPos = currentInput.selectionStart || 0
    const textBeforeCursor = message.substring(0, cursorPos)
    const textAfterCursor = message.substring(cursorPos)

    // Find the position of the @ symbol
    const lastAtPos = textBeforeCursor.lastIndexOf("@")
    if (lastAtPos === -1) return

    // Replace the @ and any partial name with the full mention
    const newText =
      textBeforeCursor.substring(0, lastAtPos) + `@${participant.name} ` + textAfterCursor

    setMessage(newText)
    // Update external state if onChange is provided
    if (onChange) {
      onChange(newText)
    }
    setShowMentions(false)

    // Set focus back to input
    setTimeout(() => {
      if (currentInput) {
        currentInput.focus()
        const newCursorPos = lastAtPos + participant.name.length + 2 // +2 for @ and space
        currentInput.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setMessage(newValue)
    // Update external state if onChange is provided
    if (onChange) {
      onChange(newValue)
    }

    if (isGroup && showMentions) {
      const cursorPos = e.target.selectionStart || 0
      const textBeforeCursor = newValue.substring(0, cursorPos)
      const lastAtPos = textBeforeCursor.lastIndexOf("@")

      if (lastAtPos !== -1) {
        const query = textBeforeCursor.substring(lastAtPos + 1).toLowerCase()
        setFilteredParticipants(
          participants.filter((p) => p.name.toLowerCase().includes(query)),
        )
      } else {
        setShowMentions(false)
      }
    }
  }

  // Close mentions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowMentions(false)
    }

    document.addEventListener("click", handleClickOutside)
    return () => {
      document.removeEventListener("click", handleClickOutside)
    }
  }, [])

  // Handle reply preview
  const renderReplyPreview = () => {
    if (!replyingTo) return null

    return (
      <div className="p-2 bg-muted/50 rounded-t-md">
        <div className="flex justify-between items-center mb-1">
          <p className="text-xs font-medium">Resposta para {replyingTo.sender.name}</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              /* Handle cancel reply */
            }}
          >
            ×
          </Button>
        </div>
        <p className="text-xs truncate">{replyingTo.content}</p>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      {renderReplyPreview()}

      <div
        className={cn(
          "flex items-center space-x-2 bg-background border rounded-md px-3 py-2 w-full",
          replyingTo && "rounded-t-none",
        )}
      >
        <Button variant="ghost" size="icon" onClick={onAttachmentClick} className="flex-shrink-0">
          <Paperclip className="h-5 w-5" />
        </Button>

        <div className="relative flex-1 w-full" onClick={(e) => e.stopPropagation()}>
          <Input
            ref={inputRef}
            type="text"
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 w-full"
          />

          {showMentions && filteredParticipants.length > 0 && (
            <div className="absolute bottom-full mb-1 w-full bg-popover border rounded-md shadow-md z-10">
              <div className="p-1 max-h-60 overflow-y-auto">
                {filteredParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
                    onClick={() => handleMentionSelect(participant)}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={participant.avatar || "/placeholder.svg?height=32&width=32"} />
                      <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{participant.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0">
          {message.trim() ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSendMessage}
              className="text-primary hover:text-primary/80"
            >
              <Send className="h-5 w-5" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={onRecordClick}>
                <Mic className="h-5 w-5" />
              </Button>
              
              <Button variant="ghost" size="icon" onClick={onScheduleClick}>
                <Calendar className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

