import { BaseAIProvider } from './base.provider.js';
import {
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamCallbacks,
  EmbedOptions,
  EmbedResult,
  ProviderCapabilities
} from '../../types/ai.types.js';
import { AIErrorCode, AIProviderError, normalizeProviderError } from './errors.js';
import { logger } from '../../utils/logger.js';
import OpenAI from 'openai';

export interface GroqProviderOptions {
  apiKey?: string;
  defaultModel?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class GroqProvider extends BaseAIProvider {
  public readonly name = 'groq';
  public readonly capabilities: ProviderCapabilities = {
    text: true,
    streaming: true,
    vision: false,       // model-dependent; conservative default
    tools: true,
    structuredOutput: true,
    embeddings: false     // Groq does not support embeddings API
  };
  private client: OpenAI | null = null;
  private defaultModel: string;

  constructor(options: GroqProviderOptions = {}) {
    super();
    this.defaultModel = options.defaultModel || 'llama-3.3-70b-versatile';
    const key = options.apiKey?.trim();

    if (key && key.length > 0) {
      this.client = new OpenAI({
        apiKey: key,
        baseURL: 'https://api.groq.com/openai/v1',
        timeout: options.timeoutMs ?? 30000,
        maxRetries: options.maxRetries ?? 2
      });
    }
  }

  public isAvailable(): boolean {
    return this.client !== null;
  }

  public async generate(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    if (!this.client) {
      throw new AIProviderError(AIErrorCode.AI_PROVIDER_UNAVAILABLE, 'Groq provider is not configured or missing API key', this.name);
    }

    const model = options?.model || this.defaultModel;
    const formattedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (options?.systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: options.systemPrompt
      });
    }

    for (const msg of messages) {
      if (msg.role === 'tool') {
        formattedMessages.push({
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.tool_call_id || ''
        });
      } else if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        formattedMessages.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.tool_calls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments)
            }
          }))
        });
      } else {
        formattedMessages.push({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content
        });
      }
    }

    try {
      const completionPayload: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages: formattedMessages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1500
      };

      if (options?.tools && options.tools.length > 0) {
        completionPayload.tools = options.tools;
      }

      const response = await this.client.chat.completions.create(completionPayload);

      const choice = response.choices[0];
      const message = choice?.message;
      const text = message?.content || '';

      const toolCalls = message?.tool_calls?.map(tc => {
        let parsedArgs: Record<string, any> = {};
        const funcName = (tc as any).function?.name || '';
        const funcArgs = (tc as any).function?.arguments || '{}';
        try {
          parsedArgs = JSON.parse(funcArgs);
        } catch {
          parsedArgs = {};
        }
        return {
          id: tc.id,
          name: funcName,
          arguments: parsedArgs
        };
      });

      return {
        text,
        model: response.model,
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens
            }
          : undefined
      };
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      const code = err?.code || 'GROQ_ERROR';
      logger.error({ status, code, model }, 'Groq provider generate error');

      throw normalizeProviderError(err, this.name);
    }
  }

  public async stream(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    options?: GenerateOptions
  ): Promise<void> {
    if (!this.client) {
      const err = new AIProviderError(AIErrorCode.AI_PROVIDER_UNAVAILABLE, 'Groq provider is not configured or missing API key', this.name);
      callbacks.onError?.(err);
      throw err;
    }

    const model = options?.model || this.defaultModel;
    const formattedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (options?.systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: options.systemPrompt
      });
    }

    for (const msg of messages) {
      if (msg.role === 'tool') {
        formattedMessages.push({
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.tool_call_id || ''
        });
      } else {
        formattedMessages.push({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content
        });
      }
    }

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages: formattedMessages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1500,
        stream: true
      });

      let accumulated = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          accumulated += content;
          callbacks.onChunk(content);
        }
      }

      callbacks.onComplete?.(accumulated);
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      const code = err?.code || 'GROQ_STREAM_ERROR';
      logger.error({ status, code, model }, 'Groq provider stream error');

      const providerError = normalizeProviderError(err, this.name);
      callbacks.onError?.(providerError);
      throw providerError;
    }
  }

  public async embed(
    _text: string,
    _options?: EmbedOptions
  ): Promise<EmbedResult> {
    throw new AIProviderError(
      AIErrorCode.AI_UNSUPPORTED_CAPABILITY,
      'Groq does not support embeddings. Use OpenAI for embedding operations.',
      this.name,
      false
    );
  }
}
