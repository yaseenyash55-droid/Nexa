import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AiWritingAssistantModal } from '../components/feed/AiWritingAssistantModal.js';
import { aiApi } from '../api/ai.api.js';

vi.mock('../api/ai.api.js', () => ({
  aiApi: {
    assistWriting: vi.fn()
  }
}));

describe('AiWritingAssistantModal Component Suite', () => {
  it('renders modal with all 8 operation choices', () => {
    render(
      <AiWritingAssistantModal
        isOpen={true}
        onClose={vi.fn()}
        currentText="Check out my new project"
        onAccept={vi.fn()}
      />
    );

    expect(screen.getByText(/Improve with NEXA AI/i)).toBeDefined();
    expect(screen.getByText(/Generate Caption/i)).toBeDefined();
    expect(screen.getByText(/Improve Writing/i)).toBeDefined();
    expect(screen.getByText(/Fix Grammar/i)).toBeDefined();
    expect(screen.getByText(/Shorten/i)).toBeDefined();
    expect(screen.getByText(/Make Professional/i)).toBeDefined();
    expect(screen.getByText(/Make Casual/i)).toBeDefined();
    expect(screen.getByText(/Generate Hashtags/i)).toBeDefined();
    expect(screen.getAllByText(/Translate/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Check out my new project/i)).toBeDefined();
  });

  it('calls assistWriting on operation click and populates preview without automatically publishing', async () => {
    const mockAssist = vi.mocked(aiApi.assistWriting).mockResolvedValueOnce({
      result: '✨ Supercharged project announcement with hashtags! #tech',
      operation: 'generate_caption',
      originalText: 'Check out my new project',
      model: 'gpt-4o-mini'
    });

    const onAccept = vi.fn();
    const onClose = vi.fn();

    render(
      <AiWritingAssistantModal
        isOpen={true}
        onClose={onClose}
        currentText="Check out my new project"
        onAccept={onAccept}
      />
    );

    fireEvent.click(screen.getByText(/Generate Caption/i));

    await waitFor(() => {
      expect(mockAssist).toHaveBeenCalledWith('generate_caption', 'Check out my new project', undefined);
    });

    await waitFor(() => {
      expect(screen.getByText(/Supercharged project announcement/i)).toBeDefined();
    });

    // Ensure accept button explicitly transfers text to caller
    const acceptBtn = screen.getByRole('button', { name: /Accept & Replace Draft/i });
    expect(acceptBtn).toBeDefined();
    fireEvent.click(acceptBtn);

    expect(onAccept).toHaveBeenCalledWith('✨ Supercharged project announcement with hashtags! #tech');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('discards preview without affecting caller when Discard is clicked', async () => {
    const onAccept = vi.fn();
    const onClose = vi.fn();

    render(
      <AiWritingAssistantModal
        isOpen={true}
        onClose={onClose}
        currentText="Draft text"
        onAccept={onAccept}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Discard/i }));
    expect(onAccept).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
