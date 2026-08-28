import { api, API_BASE_URL, getAccessToken } from './client.js';
import { ApiResponse } from '../types/index.js';

export interface AiConversation {
  conversationId: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  messageId: number;
  conversationId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface AiChatResponse {
  message: string;
  conversationId: number;
  provider: string;
  model: string;
}

export type AiWritingOperation =
  | 'generate_caption'
  | 'improve_writing'
  | 'fix_grammar'
  | 'shorten'
  | 'make_professional'
  | 'make_casual'
  | 'generate_hashtags'
  | 'translate';

export interface AiWritingResponse {
  result: string;
  operation: AiWritingOperation;
  originalText: string;
  model: string;
}

export interface StreamChatCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string, conversationId: number) => void;
  onError: (error: Error) => void;
}

export interface AiPreference {
  userId: number;
  personalizationEnabled: boolean;
  preferredLanguage: string;
  responseLength: 'concise' | 'balanced' | 'detailed';
  writingTone: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiMemory {
  memoryId: number;
  userId: number;
  keyName: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export const aiApi = {
  /**
   * Check AI service health / status
   */
  async getStatus(): Promise<{ enabled: boolean; provider: string; model: string }> {
    const res = await api.get<ApiResponse<{ enabled: boolean; provider: string; model: string }>>('/ai/status');
    return res.data.data;
  },

  /**
   * Get user personalization preferences
   */
  async getPreferences(): Promise<AiPreference> {
    const res = await api.get<ApiResponse<AiPreference>>('/ai/preferences');
    return res.data.data;
  },

  /**
   * Update user personalization preferences
   */
  async updatePreferences(updates: Partial<AiPreference>): Promise<AiPreference> {
    const res = await api.put<ApiResponse<AiPreference>>('/ai/preferences', updates);
    return res.data.data;
  },

  /**
   * Get user personalization memories
   */
  async getMemories(): Promise<AiMemory[]> {
    const res = await api.get<ApiResponse<AiMemory[]>>('/ai/memories');
    return res.data.data;
  },

  /**
   * Create a new personalization memory
   */
  async createMemory(data: { keyName: string; content: string; category?: string }): Promise<AiMemory> {
    const res = await api.post<ApiResponse<AiMemory>>('/ai/memories', data);
    return res.data.data;
  },

  /**
   * Delete an individual memory
   */
  async deleteMemory(id: number): Promise<void> {
    await api.delete(`/ai/memories/${id}`);
  },

  /**
   * Clear all memories for the authenticated user
   */
  async clearAllMemories(): Promise<void> {
    await api.delete('/ai/memories');
  },

  /**
   * Dedicated post writing assistant
   */
  async assistWriting(
    operation: AiWritingOperation,
    text?: string,
    targetLanguage?: string
  ): Promise<AiWritingResponse> {
    const res = await api.post<ApiResponse<AiWritingResponse>>('/ai/writing', {
      operation,
      text,
      targetLanguage
    });
    return res.data.data;
  },

  /**
   * Standard single or multi-turn chat request (persists to DB)
   */
  async sendMessage(message: string, conversationId?: number): Promise<AiChatResponse> {
    const res = await api.post<ApiResponse<AiChatResponse>>('/ai/chat', {
      message,
      conversationId
    });
    return res.data.data;
  },

  /**
   * Stream chat using Server-Sent Events (SSE) via fetch + ReadableStream
   */
  async streamChat(
    message: string,
    callbacks: StreamChatCallbacks,
    conversationId?: number,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const token = getAccessToken();
    const url = `${API_BASE_URL}/ai/chat/stream`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'bypass-tunnel-reminder': 'true'
        },
        body: JSON.stringify({ message, conversationId }),
        signal: abortSignal
      });

      if (!response.ok) {
        let errMsg = `Request failed with status ${response.status}`;
        try {
          const errJson = await response.json();
          errMsg = errJson.detail || errJson.error?.message || errJson.title || errMsg;
        } catch {
          // ignore parsing error
        }
        const error = new Error(errMsg);
        callbacks.onError(error);
        return;
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser or response body missing');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          if (!block.trim()) continue;

          let event = 'message';
          let data = '';

          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) {
              event = line.substring(7).trim();
            } else if (line.startsWith('data: ')) {
              data = line.substring(6).trim();
            }
          }

          if (event === 'chunk') {
            try {
              const parsed = JSON.parse(data);
              if (parsed.chunk) {
                callbacks.onChunk(parsed.chunk);
              }
            } catch {
              callbacks.onChunk(data);
            }
          } else if (event === 'complete') {
            try {
              const parsed = JSON.parse(data);
              callbacks.onComplete(parsed.message || '', parsed.conversationId);
            } catch {
              callbacks.onComplete(data, conversationId || 0);
            }
          } else if (event === 'error') {
            try {
              const parsed = JSON.parse(data);
              callbacks.onError(new Error(parsed.error || 'AI streaming error'));
            } catch {
              callbacks.onError(new Error(data || 'AI streaming error'));
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  },

  /**
   * Create a new empty conversation
   */
  async createConversation(title?: string): Promise<AiConversation> {
    const res = await api.post<ApiResponse<AiConversation>>('/ai/conversations', { title });
    return res.data.data;
  },

  /**
   * List authenticated user's conversations
   */
  async getConversations(): Promise<AiConversation[]> {
    const res = await api.get<ApiResponse<AiConversation[]>>('/ai/conversations');
    return res.data.data;
  },

  /**
   * Get single conversation messages history
   */
  async getConversation(id: number): Promise<{ conversation: AiConversation; messages: AiMessage[] }> {
    const res = await api.get<ApiResponse<{ conversation: AiConversation; messages: AiMessage[] }>>(`/ai/conversations/${id}`);
    return res.data.data;
  },

  /**
   * Delete a conversation
   */
  async deleteConversation(id: number): Promise<void> {
    await api.delete(`/ai/conversations/${id}`);
  }
};
