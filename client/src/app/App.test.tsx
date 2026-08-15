import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { App } from './App.js';

describe('Client Main Application', () => {
  it('renders Nexa application root without crashing', () => {
    render(<App />);
    const nexaElements = screen.getAllByText(/Nexa/i);
    expect(nexaElements.length).toBeGreaterThan(0);
  });
});
