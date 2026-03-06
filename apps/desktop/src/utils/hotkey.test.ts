import { describe, expect, it } from 'vitest';
import {
  getShortcutCandidate,
  SHORTCUT_SUPPORT_MESSAGE,
  validateShortcut,
} from './hotkey';

describe('hotkey utilities', () => {
  it('parses supported shortcut keys into a normalized config', () => {
    const shortcut = getShortcutCandidate({
      key: 'v',
      code: 'KeyV',
      altKey: true,
      ctrlKey: false,
      shiftKey: false,
      metaKey: true,
    });

    expect(shortcut).toEqual({
      modifiers: ['Alt', 'Meta'],
      key: 'V',
    });
  });

  it('rejects unsupported keys so the UI can show a helpful error', () => {
    const shortcut = getShortcutCandidate({
      key: '-',
      code: 'Minus',
      altKey: true,
      ctrlKey: false,
      shiftKey: false,
      metaKey: false,
    });

    expect(shortcut).toBeNull();
    expect(SHORTCUT_SUPPORT_MESSAGE).toContain('F1-F12');
  });

  it('requires at least one modifier for a valid shortcut', () => {
    const error = validateShortcut({
      modifiers: [],
      key: 'Space',
    });

    expect(error).toContain('modifier key');
  });
});
