import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageCropperModal } from '../ui/ImageCropperModal.js';

describe('ImageCropperModal Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders cropping dialog with zoom controls and aspect ratio framing', () => {
    const handleClose = vi.fn();
    const handleCropComplete = vi.fn();

    render(
      <ImageCropperModal
        isOpen={true}
        onClose={handleClose}
        imageSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        aspectRatio={1}
        cropShape="round"
        title="Crop Profile Photo (1:1)"
        onCropComplete={handleCropComplete}
      />
    );

    expect(screen.getByText('Crop Profile Photo (1:1)')).toBeDefined();
    expect(screen.getByText('Apply & Crop')).toBeDefined();
    expect(screen.getByText('Rotate')).toBeDefined();
    expect(screen.getByText('Reset')).toBeDefined();
    expect(screen.getByRole('slider')).toBeDefined();
  });

  it('adjusts zoom value and triggers rotation on user interaction', () => {
    render(
      <ImageCropperModal
        isOpen={true}
        onClose={vi.fn()}
        imageSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        aspectRatio={2.5}
        cropShape="rect"
        title="Crop Cover Banner (Wide)"
        onCropComplete={vi.fn()}
      />
    );

    const slider = screen.getByRole('slider') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '2.0' } });
    expect(screen.getByText('2.0x')).toBeDefined();

    const rotateBtn = screen.getByText('Rotate');
    fireEvent.click(rotateBtn);

    const resetBtn = screen.getByText('Reset');
    fireEvent.click(resetBtn);
    expect(screen.getByText('1.0x')).toBeDefined();
  });
});
