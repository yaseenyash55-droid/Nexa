export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCall[];
}

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  }>;
}

export interface GenerateResult {
  text: string;
  model: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (err: Error) => void;
}

export interface EmbedOptions {
  model?: string;
}

export interface EmbedResult {
  embedding: number[];
  model: string;
}

export interface ProviderCapabilities {
  text: boolean;
  streaming: boolean;
  vision: boolean;
  tools: boolean;
  structuredOutput: boolean;
  embeddings: boolean;
}

export interface AIProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  isAvailable(): boolean;
  generate(messages: ChatMessage[], options?: GenerateOptions): Promise<GenerateResult>;
  stream(messages: ChatMessage[], callbacks: StreamCallbacks, options?: GenerateOptions): Promise<void>;
  embed(text: string, options?: EmbedOptions): Promise<EmbedResult>;
}

export interface AiStatusResponse {
  enabled: boolean;
  provider: string;
  model: string;
  available: boolean;
  capabilities: ProviderCapabilities;
  fallbackProvider?: string;
  fallbackAvailable?: boolean;
}

export interface AiConversation {
  conversationId: number;
  userId: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiMessage {
  messageId: number;
  conversationId: number;
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface RagDocument {
  docId: number;
  source: string;
  title: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RagChunk {
  chunkId: number;
  docId: number;
  chunkIndex: number;
  content: string;
  metadata: Record<string, any>;
  embedding: number[];
  createdAt: Date;
}

export interface RagSearchResult {
  chunkId: number;
  docId: number;
  source: string;
  title: string;
  content: string;
  similarity: number;
  metadata: Record<string, any>;
}

export interface IAiRepository {
  createConversation(userId: number, title: string): Promise<AiConversation>;
  getConversationById(conversationId: number, userId: number): Promise<AiConversation | null>;
  getUserConversations(userId: number, limit?: number): Promise<AiConversation[]>;
  saveMessage(conversationId: number, role: 'system' | 'user' | 'assistant', content: string): Promise<AiMessage>;
  getConversationMessages(conversationId: number, userId: number): Promise<AiMessage[]>;
  touchConversation(conversationId: number): Promise<void>;
  deleteConversation(conversationId: number, userId: number): Promise<boolean>;
}

export interface IRagDocumentRepository {
  upsertDocument(source: string, title: string, category: string): Promise<RagDocument>;
  saveChunks(docId: number, chunks: Array<{ chunkIndex: number; content: string; metadata: Record<string, any>; embedding: number[] }>): Promise<void>;
  getAllChunksWithEmbeddings(): Promise<Array<{ chunkId: number; docId: number; source: string; title: string; content: string; metadata: Record<string, any>; embedding: number[] }>>;
  getDocumentsCount(): Promise<number>;
  getChunksCount(): Promise<number>;
}

export interface AiPreference {
  userId: number;
  personalizationEnabled: boolean;
  preferredLanguage: string;
  responseLength: 'concise' | 'balanced' | 'detailed';
  writingTone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiMemory {
  memoryId: number;
  userId: number;
  keyName: string;
  content: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAiMemoryRepository {
  getPreferences(userId: number): Promise<AiPreference>;
  updatePreferences(userId: number, updates: Partial<AiPreference>): Promise<AiPreference>;
  getMemories(userId: number): Promise<AiMemory[]>;
  getMemoryById(memoryId: number, userId: number): Promise<AiMemory | null>;
  createMemory(userId: number, keyName: string, content: string, category?: string): Promise<AiMemory>;
  deleteMemory(memoryId: number, userId: number): Promise<boolean>;
  clearAllMemories(userId: number): Promise<number>;
}
