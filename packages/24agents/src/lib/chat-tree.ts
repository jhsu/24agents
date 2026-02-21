export interface BranchSuggestion {
  id: string
  label: string
  description: string
}

export interface ChatNode {
  id: string
  parentId: string | null
  role: "user" | "assistant"
  content: string
  branches: BranchSuggestion[]
  selectedBranchId: string | null
  childIds: string[]
  createdAt: number
  personaId: string | null
}

export interface ChatTree {
  id: string
  rootId: string | null
  nodes: Record<string, ChatNode>
  currentNodeId: string | null
  personaId: string | null
  title: string
  createdAt: number
}

export function createTree(personaId: string | null = null): ChatTree {
  return {
    id: crypto.randomUUID(),
    rootId: null,
    nodes: {},
    currentNodeId: null,
    personaId,
    title: "New Conversation",
    createdAt: Date.now(),
  }
}

export function createNode(
  role: "user" | "assistant",
  content: string,
  parentId: string | null,
  personaId: string | null = null,
): ChatNode {
  return {
    id: crypto.randomUUID(),
    parentId,
    role,
    content,
    branches: [],
    selectedBranchId: null,
    childIds: [],
    createdAt: Date.now(),
    personaId,
  }
}

export function addNode(tree: ChatTree, node: ChatNode): ChatTree {
  const nodes = { ...tree.nodes, [node.id]: node }

  if (node.parentId && nodes[node.parentId]) {
    const parent = nodes[node.parentId]
    nodes[node.parentId] = {
      ...parent,
      childIds: [...parent.childIds, node.id],
    }
  }

  return {
    ...tree,
    nodes,
    rootId: tree.rootId ?? node.id,
    currentNodeId: node.id,
  }
}

export function getPathToNode(tree: ChatTree, nodeId: string): ChatNode[] {
  const path: ChatNode[] = []
  let current = tree.nodes[nodeId]
  while (current) {
    path.unshift(current)
    current = current.parentId ? tree.nodes[current.parentId] : undefined!
  }
  return path
}

export function setBranches(
  tree: ChatTree,
  nodeId: string,
  branches: BranchSuggestion[],
): ChatTree {
  const node = tree.nodes[nodeId]
  if (!node) return tree
  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [nodeId]: { ...node, branches },
    },
  }
}

export function selectBranch(
  tree: ChatTree,
  nodeId: string,
  branchId: string,
): ChatTree {
  const node = tree.nodes[nodeId]
  if (!node) return tree
  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [nodeId]: { ...node, selectedBranchId: branchId },
    },
  }
}

export function getConversationHistory(
  tree: ChatTree,
  nodeId: string,
): { role: "user" | "assistant"; content: string }[] {
  const path = getPathToNode(tree, nodeId)
  return path.map((n) => ({ role: n.role, content: n.content }))
}

// Persistence
const CHAT_PREFIX = "24agents:chat:"
const CHAT_LIST_KEY = "24agents:chat-list"

export interface ChatListEntry {
  id: string
  title: string
  personaId: string | null
  createdAt: number
  updatedAt: number
}

export function saveChatTree(tree: ChatTree): void {
  localStorage.setItem(CHAT_PREFIX + tree.id, JSON.stringify(tree))
  updateChatList(tree)
}

export function loadChatTree(id: string): ChatTree | null {
  try {
    const raw = localStorage.getItem(CHAT_PREFIX + id)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function deleteChatTree(id: string): void {
  localStorage.removeItem(CHAT_PREFIX + id)
  const list = loadChatList().filter((e) => e.id !== id)
  localStorage.setItem(CHAT_LIST_KEY, JSON.stringify(list))
}

export function loadChatList(): ChatListEntry[] {
  try {
    const raw = localStorage.getItem(CHAT_LIST_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function updateChatList(tree: ChatTree): void {
  const list = loadChatList()
  const idx = list.findIndex((e) => e.id === tree.id)
  const entry: ChatListEntry = {
    id: tree.id,
    title: tree.title,
    personaId: tree.personaId,
    createdAt: tree.createdAt,
    updatedAt: Date.now(),
  }
  if (idx >= 0) {
    list[idx] = entry
  } else {
    list.unshift(entry)
  }
  localStorage.setItem(CHAT_LIST_KEY, JSON.stringify(list))
}
