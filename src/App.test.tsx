import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { renderWithProviders } from './test/render';

describe('App', () => {
  it('renders the application shell', () => {
    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'pttrnly' })).toBeInTheDocument();
  });

  it('follows the system colour scheme by default', () => {
    const { store } = renderWithProviders(<App />);

    expect(store.getState().theme.preference).toBe('system');
  });
});
