import { useState, useCallback } from "react"
import {
  type ChatListEntry,
  loadChatList,
  deleteChatTree,
} from "@/lib/chat-tree"

export function useChatList() {
  const [entries, setEntries] = useState<ChatListEntry[]>(() => loadChatList())

  const refresh = useCallback(() => {
    setEntries(loadChatList())
  }, [])

  const remove = useCallback(
    (id: string) => {
      deleteChatTree(id)
      refresh()
    },
    [refresh],
  )

  return { entries, refresh, remove }
}
