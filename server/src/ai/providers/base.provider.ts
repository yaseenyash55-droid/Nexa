import {
  AIProvider,
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamCallbacks,
  EmbedOptions,
  EmbedResult,
  ProviderCapabilities
} from '../../types/ai.types.js';

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string;
  public readonly capabilities: ProviderCapabilities = {
    text: true,
    streaming: true,
    vision: true,
    tools: true,
    structuredOutput: true,
    embeddings: true
  };

  abstract isAvailable(): boolean;

  abstract generate(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<GenerateResult>;

  abstract stream(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    options?: GenerateOptions
  ): Promise<void>;

  abstract embed(
    text: string,
    options?: EmbedOptions
  ): Promise<EmbedResult>;
}
