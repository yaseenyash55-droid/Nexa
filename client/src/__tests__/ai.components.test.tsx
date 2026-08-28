import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AiWelcomeScreen } from '../components/chat/AiWelcomeScreen.js';
import { AiComposer } from '../components/chat/AiComposer.js';
import { AiMessageBubble } from '../components/chat/AiMessageBubble.js';

vi.mock('../contexts/AuthContext.js', () => ({
  useAuth: () => ({
    user: { userId: 1, username: 'tester', displayName: 'Tester' },
    requireAuth: (fn: () => void) => fn()
  })
}));

describe('NEXA AI Chat Components Suite', () => {
  it('renders AiWelcomeScreen with starter suggestions', () => {
    const onSelectPrompt = vi.fn();
    render(<AiWelcomeScreen onSelectPrompt={onSelectPrompt} />);

    expect(screen.getByText(/How can/i)).toBeDefined();
    expect(screen.getAllByText(/NEXA AI/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Write a caption/i)).toBeDefined();
    expect(screen.getByText(/Improve my writing/i)).toBeDefined();
    expect(screen.getAllByText(/Translate text/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Summarize something/i)).toBeDefined();
    expect(screen.getByText(/Ask a question/i)).toBeDefined();

    fireEvent.click(screen.getByText(/Write a caption/i));
    expect(onSelectPrompt).toHaveBeenCalledTimes(1);
    expect(onSelectPrompt).toHaveBeenCalledWith(expect.stringContaining('caption'));
  });

  it('renders AiComposer and enables send button only when input is provided', () => {
    const setInput = vi.fn();
    const onSend = vi.fn();
    const onStop = vi.fn();

    const { rerender } = render(
      <AiComposer
        input=""
        setInput={setInput}
        onSend={onSend}
        onStop={onStop}
        isLoading={false}
      />
    );

    const sendBtn = screen.getByRole('button', { name: /Send message/i }) as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(true);

    rerender(
      <AiComposer
        input="Tell me a joke"
        setInput={setInput}
        onSend={onSend}
        onStop={onStop}
        isLoading={false}
      />
    );

    const activeSendBtn = screen.getByRole('button', { name: /Send message/i }) as HTMLButtonElement;
    expect(activeSendBtn.disabled).toBe(false);
    fireEvent.click(activeSendBtn);
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('renders stop generation button when streaming', () => {
    const setInput = vi.fn();
    const onSend = vi.fn();
    const onStop = vi.fn();

    render(
      <AiComposer
        input="Streaming question"
        setInput={setInput}
        onSend={onSend}
        onStop={onStop}
        isLoading={true}
      />
    );

    const stopBtn = screen.getByRole('button', { name: /Stop generation/i });
    expect(stopBtn).toBeDefined();
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('renders AiMessageBubble for assistant with copy capability', () => {
    render(
      <AiMessageBubble
        message={{
          role: 'assistant',
          content: 'Here is a tailored caption for your post #nexalife',
          createdAt: new Date().toISOString()
        }}
      />
    );

    expect(screen.getByText(/Here is a tailored caption/i)).toBeDefined();
    expect(screen.getAllByText(/NEXA AI/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Copy message/i })).toBeDefined();
  });
});
