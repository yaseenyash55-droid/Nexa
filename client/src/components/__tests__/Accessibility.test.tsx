import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';

describe('Design System & UI Accessibility Suite', () => {
  it('should render modal with proper ARIA attributes and focus backdrop', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Accessibility Test Modal">
        <p>Modal content inside dialog.</p>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Accessibility Test Modal')).toBeDefined();
  });

  it('should trigger onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Escape Test">
        <button>Focusable Child</button>
      </Modal>
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should render button with accessible touch target attributes', () => {
    render(<Button aria-label="Perform Action">Click Me</Button>);
    const button = screen.getByRole('button', { name: /Perform Action/i });
    expect(button).toBeDefined();
    expect(button.className).toContain('min-h-[44px]');
  });
});
