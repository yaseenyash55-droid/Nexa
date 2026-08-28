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
  abstract readonly capabilities: ProviderCapabilities;

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
