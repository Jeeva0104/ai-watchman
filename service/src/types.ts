export interface TransformedPayload {
  projectName: string | null
  session: string
  slug: string | null
  transcriptPath: string | null
  type: string
  action: string | null
  tool: string | null
  toolUseId: string | null
  ts: number
  ownerAgentId: string | null
  subAgentId: string | null
  subAgentName: string | null
  subAgentDescription: string | null
  subAgentType: string | null
  skillType: string | null
  metadata: Record<string, unknown>
  source: Record<string, unknown>
  summary: string | null
}

export interface ProcessedItem {
  id: number
  agentId: string
  session: string
  type: string
  action: string | null
  tool: string | null
  toolUseId: string | null
  status: string
  ts: number
  payload: Record<string, unknown>
}