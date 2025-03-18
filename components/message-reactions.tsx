"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { SmilePlus } from "lucide-react"

interface MessageReactionsProps {
  messageId: string
  chatId: string
  userId: string
  existingReactions?: {
    emoji: string
    count: number
    users: string[]
  }[]
  onReactionAdd: (messageId: string, emoji: string) => void
}

const EMOJI_LIST = [
  { emoji: "👍", name: "Curtir" },
  { emoji: "❤️", name: "Amei" },
  { emoji: "😂", name: "Haha" },
  { emoji: "😮", name: "Uau" },
  { emoji: "😢", name: "Triste" },
  { emoji: "😡", name: "Grr" },
]

export default function MessageReactions({
  messageId,
  chatId,
  userId,
  existingReactions = [],
  onReactionAdd,
}: MessageReactionsProps) {
  const [reactions, setReactions] = useState(existingReactions)

  const handleReaction = (emoji: string) => {
    // Call the parent component's handler
    onReactionAdd(messageId, emoji)

    // Optimistically update the UI
    const existingReaction = reactions.find((r) => r.emoji === emoji)

    if (existingReaction) {
      // Check if user already reacted with this emoji
      if (existingReaction.users.includes(userId)) {
        // Remove user's reaction
        const updatedReactions = reactions
          .map((r) => {
            if (r.emoji === emoji) {
              return {
                ...r,
                count: r.count - 1,
                users: r.users.filter((id) => id !== userId),
              }
            }
            return r
          })
          .filter((r) => r.count > 0) // Remove reactions with 0 count

        setReactions(updatedReactions)
      } else {
        // Add user's reaction
        const updatedReactions = reactions.map((r) => {
          if (r.emoji === emoji) {
            return {
              ...r,
              count: r.count + 1,
              users: [...r.users, userId],
            }
          }
          return r
        })

        setReactions(updatedReactions)
      }
    } else {
      // Create new reaction
      setReactions([
        ...reactions,
        {
          emoji,
          count: 1,
          users: [userId],
        },
      ])
    }
  }

  return (
    <div className="flex items-center mt-1 space-x-1">
      {reactions
        .filter((r) => r.count > 0)
        .map((reaction) => (
          <TooltipProvider key={reaction.emoji}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-6 px-1.5 rounded-full text-xs ${
                    reaction.users.includes(userId) ? "bg-primary/20 hover:bg-primary/30" : "bg-muted hover:bg-muted/80"
                  }`}
                  onClick={() => handleReaction(reaction.emoji)}
                >
                  <span className="mr-1">{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {reaction.users.length <= 3
                  ? reaction.users.join(", ")
                  : `${reaction.users.slice(0, 3).join(", ")} e mais ${reaction.users.length - 3}`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
            <SmilePlus className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="flex gap-1">
            {EMOJI_LIST.map((item) => (
              <TooltipProvider key={item.emoji}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => handleReaction(item.emoji)}
                    >
                      {item.emoji}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.name}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

