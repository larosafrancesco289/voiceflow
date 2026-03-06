import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const mocks = vi.hoisted(() => ({
  useTranscriptionMock: vi.fn(() => ({
    analyser: null,
    isReady: true,
    startServer: vi.fn(),
  })),
}));

vi.mock('./hooks/useTranscription', () => ({
  useTranscription: mocks.useTranscriptionMock,
}));

vi.mock('./components', () => ({
  Onboarding: () => <div>Onboarding</div>,
  VoicePill: () => <div>VoicePill</div>,
  MainApp: ({ initialTab }: { initialTab?: 'home' | 'settings' }) => (
    <div>MainApp:{initialTab ?? 'home'}</div>
  ),
}));

describe('App', () => {
  beforeEach(() => {
    mocks.useTranscriptionMock.mockClear();
  });

  it('syncs server status for the main app window without shortcut listeners', () => {
    window.history.pushState({}, '', '/main');

    render(<App />);

    expect(screen.getByText('MainApp:home')).toBeTruthy();
    expect(mocks.useTranscriptionMock).toHaveBeenCalledWith({
      autoStart: true,
      listenForGlobalShortcuts: false,
    });
  });
});
