import { useState, useCallback } from "react"
import {
  type ChatTree,
  type BranchSuggestion,
  createTree,
  createNode,
  addNode,
  getPathToNode,
  setBranches,
  selectBranch,
  getConversationHistory,
  saveChatTree,
  loadChatTree,
} from "@/lib/chat-tree"
import { streamChat, fetchBranches, persistToMemory } from "@/lib/sse-client"

export function useChatTree(treeId?: string, personaId: string | null = null) {
  const [tree, setTree] = useState<ChatTree>(() => {
    if (treeId) {
      const loaded = loadChatTree(treeId)
      if (loaded) return loaded
    }
    return createTree(personaId)
  })

  const [isStreaming, setIsStreaming] = useState(false)
  const [isFetchingBranches, setIsFetchingBranches] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")

  const persist = useCallback((updated: ChatTree) => {
    setTree(updated)
    saveChatTree(updated)
  }, [])

  const currentPath = tree.currentNodeId
    ? getPathToNode(tree, tree.currentNodeId)
    : []

  const sendMessage = useCallback(
    async (content: string, systemPrompt?: string) => {
      if (isStreaming) return

      // Add user node
      const userNode = createNode("user", content, tree.currentNodeId, tree.personaId)
      let updated = addNode(tree, userNode)

      // Set title from first message
      if (Object.keys(tree.nodes).length === 0) {
        updated = { ...updated, title: content.slice(0, 60) }
      }

      persist(updated)

      // Start streaming assistant response
      setIsStreaming(true)
      setStreamingContent("")

      const history = getConversationHistory(updated, userNode.id)
      let fullResponse = ""

      try {
        for await (const chunk of streamChat(content, history.slice(0, -1), systemPrompt, tree.id)) {
          fullResponse += chunk
          setStreamingContent(fullResponse)
        }
      } catch (err) {
        fullResponse = fullResponse || `Error: ${err instanceof Error ? err.message : "Failed to get response"}`
      }

      // Add assistant node
      const assistantNode = createNode("assistant", fullResponse, userNode.id, tree.personaId)
      updated = addNode(updated, assistantNode)
      persist(updated)
      setIsStreaming(false)
      setStreamingContent("")

      // Fetch branch suggestions
      setIsFetchingBranches(true)
      try {
        const conversationHistory = getConversationHistory(updated, assistantNode.id)
        const branches = await fetchBranches(
          conversationHistory,
          fullResponse,
          systemPrompt,
        )
        const withBranches = setBranches(updated, assistantNode.id, branches)
        persist(withBranches)

        // Fire-and-forget: persist conversation to long-term memory
        const fullHistory = getConversationHistory(withBranches, assistantNode.id)
        persistToMemory(
          withBranches.id,
          fullHistory,
          withBranches.title,
          withBranches.personaId,
        ).catch(() => {})
      } catch {
        // Branches are optional, continue without them
      }
      setIsFetchingBranches(false)
    },
    [tree, isStreaming, persist],
  )

  const handleSelectBranch = useCallback(
    async (nodeId: string, branch: BranchSuggestion, systemPrompt?: string) => {
      const updated = selectBranch(tree, nodeId, branch.id)
      persist(updated)
      // Send the branch label as the user's next message
      await sendMessage(branch.label + ": " + branch.description, systemPrompt)
    },
    [tree, persist, sendMessage],
  )

  const navigateTo = useCallback(
    (nodeId: string) => {
      persist({ ...tree, currentNodeId: nodeId })
    },
    [tree, persist],
  )

  const resetTree = useCallback(
    (newPersonaId: string | null = null) => {
      const fresh = createTree(newPersonaId)
      persist(fresh)
    },
    [persist],
  )

  const loadTree = useCallback(
    (id: string) => {
      const loaded = loadChatTree(id)
      if (loaded) {
        setTree(loaded)
      }
    },
    [],
  )

  return {
    tree,
    currentPath,
    isStreaming,
    isFetchingBranches,
    streamingContent,
    sendMessage,
    selectBranch: handleSelectBranch,
    navigateTo,
    resetTree,
    loadTree,
  }
}
