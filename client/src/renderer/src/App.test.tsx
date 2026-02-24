import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('should render the app with title', () => {
    render(<App />);
    expect(screen.getByText('Discord Clone')).toBeInTheDocument();
  });
});
