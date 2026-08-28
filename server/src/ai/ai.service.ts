import { getAIProvider, getFallbackProvider, generateWithFallback, streamWithFallback } from './providers/factory.js';
import { getAiRepository, getAiMemoryRepository } from '../repositories/factory.js';
import {
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamCallbacks,
  AiStatusResponse,
  AiConversation,
  AiMessage,
  AiPreference,
  AiMemory
} from '../types/ai.types.js';
import { env } from '../config/env.js';
import { NEXA_AI_SYSTEM_PROMPT, NEXA_AI_WRITING_SYSTEM_PROMPT, formatWritingPrompt } from './prompts/system.prompts.js';
import { logger } from '../utils/logger.js';
import { AiWritingOperation } from '../schemas/ai.schema.js';

import { ragRetriever } from './rag/retriever.js';
import { toolRegistry, ToolExecutionContext } from './tools/tool.registry.js';

export interface ChatCompletionResult {
  message: string;
  conversationId: number;
  model: string;
  sources?: Array<{ title: string; source: string }>;
}

export interface WritingAssistantResult {
  result: string;
  operation: AiWritingOperation;
  originalText: string;
  model: string;
}

// Bounded multi-turn context constraints (Phase 13)
const MAX_CONTEXT_MESSAGES = 20;
const MAX_CONTEXT_CHARS = 12000;

export class AIService {
  public getStatus(): AiStatusResponse {
    const provider = getAIProvider();
    const fb = getFallbackProvider();
    const model = provider.name === 'groq' ? env.GROQ_MODEL : env.OPENAI_MODEL;
    return {
      enabled: env.AI_ENABLED,
      provider: provider.name,
      model,
      available: env.AI_ENABLED && provider.isAvailable(),
      capabilities: provider.capabilities,
      fallbackProvider: fb?.name,
      fallbackAvailable: fb?.isAvailable()
    };
  }

  /**
   * Deterministically generate a clean conversation title from first user message (max 80 chars)
   */
  public generateConversationTitle(message: string): string {
    if (!message || !message.trim()) return 'New Conversation';
    const clean = message
      .replace(/[\r\n]+/g, ' ')
      .replace(/[#*`_~]/g, '')
      .trim();
    if (clean.length <= 80) return clean;
    return clean.slice(0, 77) + '...';
  }

  /**
   * Build bounded multi-turn conversation messages respecting message count and total character limit
   */
  public buildBoundedHistory(
    existingMessages: AiMessage[],
    currentMessage: string
  ): ChatMessage[] {
    const validHistory = existingMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
      .slice(-MAX_CONTEXT_MESSAGES);

    const selected: ChatMessage[] = [];
    let currentChars = currentMessage.length;

    // Traverse from newest to oldest
    for (let i = validHistory.length - 1; i >= 0; i--) {
      const msg = validHistory[i];
      const msgLength = msg.content.length;
      if (currentChars + msgLength > MAX_CONTEXT_CHARS) {
        break;
      }
      selected.unshift({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      });
      currentChars += msgLength;
    }

    return [...selected, { role: 'user', content: currentMessage }];
  }

  public async getOrCreateConversation(
    userId: number,
    conversationId?: number,
    initialMessage?: string
  ): Promise<AiConversation> {
    const aiRepo = getAiRepository();

    if (conversationId && conversationId > 0) {
      const existing = await aiRepo.getConversationById(conversationId, userId);
      if (!existing) {
        throw new Error('CONVERSATION_FORBIDDEN_OR_NOT_FOUND');
      }
      return existing;
    }

    const title = this.generateConversationTitle(initialMessage || '');
    return aiRepo.createConversation(userId, title);
  }

  public async chat(
    userId: number,
    message: string,
    conversationId?: number
  ): Promise<ChatCompletionResult> {
    if (!env.AI_ENABLED) {
      throw new Error('AI_DISABLED');
    }

    const provider = getAIProvider();
    if (!provider.isAvailable()) {
      throw new Error('AI_PROVIDER_UNAVAILABLE');
    }

    const conv = await this.getOrCreateConversation(userId, conversationId, message);
    const aiRepo = getAiRepository();

    // Fetch prior messages for conversation context (bounded multi-turn history)
    const existingMessages = await aiRepo.getConversationMessages(conv.conversationId, userId);
    const messages = this.buildBoundedHistory(existingMessages, message);

    // Save current user message to database
    await aiRepo.saveMessage(conv.conversationId, 'user', message);

    // Retrieve relevant documentation context via RAG
    let ragSystemPrompt = NEXA_AI_SYSTEM_PROMPT;
    let sources: Array<{ title: string; source: string }> = [];
    try {
      const ragResults = await ragRetriever.retrieve(message, { topK: 2 });
      if (ragResults.length > 0) {
        ragSystemPrompt += ragRetriever.formatContext(ragResults);
        sources = ragResults.map(r => ({ title: r.title, source: r.source }));
      }
    } catch (err: any) {
      logger.warn({ err: err?.message || err }, 'RAG context retrieval failed; proceeding without RAG augmentation');
    }

    // Retrieve user personalization preferences & memories
    try {
      const memoryRepo = getAiMemoryRepository();
      const prefs = await memoryRepo.getPreferences(userId);
      if (prefs.personalizationEnabled) {
        const memories = await memoryRepo.getMemories(userId);
        let personalizationContext = `\n\n[User Personalization Context - Owned by User ${userId}]`;
        personalizationContext += `\nPreferred Language: ${prefs.preferredLanguage}`;
        personalizationContext += `\nResponse Length: ${prefs.responseLength}`;
        personalizationContext += `\nWriting Tone: ${prefs.writingTone}`;

        if (memories.length > 0) {
          personalizationContext += `\nUser Preferences & Interests:\n` + memories.map((m: AiMemory) => `- ${m.keyName}: ${m.content}`).join('\n');
        }
        personalizationContext += `\nAdhere to these preferences when generating responses.`;
        ragSystemPrompt += personalizationContext;
      }
    } catch (err: any) {
      logger.warn({ err: err?.message || err, userId }, 'Failed to load user AI memories/preferences; continuing without personalization');
    }

    const tools = provider.capabilities.tools ? toolRegistry.getOpenAiToolDefinitions() : [];

    const providerModel = provider.name === 'groq' ? env.GROQ_MODEL : (env.OPENAI_MODEL || env.AI_MODEL);

    let result = await generateWithFallback(messages, {
      systemPrompt: ragSystemPrompt,
      model: providerModel,
      maxTokens: 1500,
      temperature: 0.7,
      tools: tools.length > 0 ? tools : undefined
    });

    // If model requested tool calls, execute them safely on server and perform second-turn generation
    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolCallMessages: ChatMessage[] = [
        ...messages,
        {
          role: 'assistant',
          content: result.text || '',
          tool_calls: result.toolCalls
        }
      ];

      const context: ToolExecutionContext = {
        userId,
        username: `user_${userId}`
      };

      for (const tc of result.toolCalls) {
        const executionResult = await toolRegistry.executeTool(tc.name, tc.arguments, context);
        toolCallMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.name,
          content: JSON.stringify(executionResult.success ? executionResult.data : { error: executionResult.error })
        });
      }

      // Second generation turn with tool outputs
      result = await generateWithFallback(toolCallMessages, {
        systemPrompt: ragSystemPrompt,
        model: providerModel,
        maxTokens: 1500,
        temperature: 0.7
      });
    }

    // Save assistant response to database
    await aiRepo.saveMessage(conv.conversationId, 'assistant', result.text);

    return {
      message: result.text,
      conversationId: conv.conversationId,
      model: result.model,
      sources: sources.length > 0 ? sources : undefined
    };
  }

  public async streamChat(
    userId: number,
    message: string,
    callbacks: StreamCallbacks,
    conversationId?: number
  ): Promise<number> {
    if (!env.AI_ENABLED) {
      const err = new Error('AI_DISABLED');
      callbacks.onError?.(err);
      throw err;
    }

    const provider = getAIProvider();
    if (!provider.isAvailable()) {
      const err = new Error('AI_PROVIDER_UNAVAILABLE');
      callbacks.onError?.(err);
      throw err;
    }

    const conv = await this.getOrCreateConversation(userId, conversationId, message);
    const aiRepo = getAiRepository();

    const existingMessages = await aiRepo.getConversationMessages(conv.conversationId, userId);
    const messages = this.buildBoundedHistory(existingMessages, message);

    // Save user message to database
    await aiRepo.saveMessage(conv.conversationId, 'user', message);

    // Retrieve relevant documentation context via RAG
    let ragSystemPrompt = NEXA_AI_SYSTEM_PROMPT;
    try {
      const ragResults = await ragRetriever.retrieve(message, { topK: 2 });
      if (ragResults.length > 0) {
        ragSystemPrompt += ragRetriever.formatContext(ragResults);
      }
    } catch (err: any) {
      logger.warn({ err: err?.message || err }, 'RAG context retrieval failed during stream; proceeding without RAG augmentation');
    }

    const providerModel = provider.name === 'groq' ? env.GROQ_MODEL : (env.OPENAI_MODEL || env.AI_MODEL);

    try {
      await streamWithFallback(
        messages,
        {
          onChunk: callbacks.onChunk,
          onComplete: async (fullText: string) => {
            try {
              if (fullText && fullText.trim()) {
                await aiRepo.saveMessage(conv.conversationId, 'assistant', fullText);
              }
            } catch (err: any) {
              logger.error({ err: err?.message || err, convId: conv.conversationId }, 'Failed to persist assistant stream message');
            }
            if (callbacks.onComplete) {
              await callbacks.onComplete(fullText);
            }
          },
          onError: callbacks.onError
        },
        {
          systemPrompt: ragSystemPrompt,
          model: providerModel,
          maxTokens: 1500,
          temperature: 0.7
        }
      );
    } catch (streamErr: any) {
      callbacks.onError?.(streamErr);
    }

    return conv.conversationId;
  }

  public async listUserConversations(userId: number, limit = 50): Promise<AiConversation[]> {
    const aiRepo = getAiRepository();
    return aiRepo.getUserConversations(userId, limit);
  }

  public async getConversationDetails(
    conversationId: number,
    userId: number
  ): Promise<{ conversation: AiConversation; messages: AiMessage[] }> {
    const aiRepo = getAiRepository();
    const conversation = await aiRepo.getConversationById(conversationId, userId);
    if (!conversation) {
      throw new Error('CONVERSATION_FORBIDDEN_OR_NOT_FOUND');
    }

    const messages = await aiRepo.getConversationMessages(conversationId, userId);
    return { conversation, messages };
  }

  public async deleteConversation(conversationId: number, userId: number): Promise<boolean> {
    const aiRepo = getAiRepository();
    return aiRepo.deleteConversation(conversationId, userId);
  }

  public async generateWritingAssistant(
    userId: number,
    operation: AiWritingOperation,
    text: string,
    targetLanguage?: string
  ): Promise<WritingAssistantResult> {
    const provider = getAIProvider();

    if (!env.AI_ENABLED || !provider.isAvailable()) {
      throw new Error('AI_PROVIDER_UNAVAILABLE');
    }

    const formattedUserPrompt = formatWritingPrompt(operation, text, targetLanguage);

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: formattedUserPrompt
      }
    ];

    const provider = getAIProvider();
    const providerModel = provider.name === 'groq' ? env.GROQ_MODEL : (env.OPENAI_MODEL || env.AI_MODEL);

    const generateOptions: GenerateOptions = {
      systemPrompt: NEXA_AI_WRITING_SYSTEM_PROMPT,
      model: providerModel,
      maxTokens: 1000,
      temperature: 0.7
    };

    const response = await provider.generate(messages, generateOptions);

    // Clean any accidental markdown codeblock quotes around simple generated text
    let cleanedResult = response.text.trim();
    if (cleanedResult.startsWith('```') && cleanedResult.endsWith('```')) {
      cleanedResult = cleanedResult.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    }

    return {
      result: cleanedResult,
      operation,
      originalText: text,
      model: response.model
    };
  }

  public async generate(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    if (!env.AI_ENABLED) {
      throw new Error('AI_DISABLED');
    }

    const provider = getAIProvider();
    if (!provider.isAvailable()) {
      throw new Error('AI_PROVIDER_UNAVAILABLE');
    }

    return provider.generate(messages, {
      systemPrompt: options?.systemPrompt || NEXA_AI_SYSTEM_PROMPT,
      ...options
    });
  }

  public async stream(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    options?: GenerateOptions
  ): Promise<void> {
    if (!env.AI_ENABLED) {
      const err = new Error('AI_DISABLED');
      callbacks.onError?.(err);
      throw err;
    }

    const provider = getAIProvider();
    if (!provider.isAvailable()) {
      const err = new Error('AI_PROVIDER_UNAVAILABLE');
      callbacks.onError?.(err);
      throw err;
    }

    return provider.stream(messages, callbacks, {
      systemPrompt: options?.systemPrompt || NEXA_AI_SYSTEM_PROMPT,
      ...options
    });
  }

  public async getUserPreferences(userId: number): Promise<AiPreference> {
    return getAiMemoryRepository().getPreferences(userId);
  }

  public async updateUserPreferences(userId: number, updates: Partial<AiPreference>): Promise<AiPreference> {
    return getAiMemoryRepository().updatePreferences(userId, updates);
  }

  public async getUserMemories(userId: number): Promise<AiMemory[]> {
    return getAiMemoryRepository().getMemories(userId);
  }

  public async createMemory(userId: number, keyName: string, content: string, category = 'general'): Promise<AiMemory> {
    return getAiMemoryRepository().createMemory(userId, keyName, content, category);
  }

  public async deleteMemory(memoryId: number, userId: number): Promise<boolean> {
    const memory = await getAiMemoryRepository().getMemoryById(memoryId, userId);
    if (!memory || memory.userId !== userId) {
      throw new Error('MEMORY_FORBIDDEN_OR_NOT_FOUND');
    }
    return getAiMemoryRepository().deleteMemory(memoryId, userId);
  }

  public async clearAllMemories(userId: number): Promise<number> {
    return getAiMemoryRepository().clearAllMemories(userId);
  }
}

export const aiService = new AIService();
