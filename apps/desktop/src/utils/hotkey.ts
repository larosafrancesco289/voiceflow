export interface ShortcutKeyInfo {
  modifiers: string[];
  key: string;
}

export interface ShortcutKeyboardEventLike {
  key: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

const MODIFIER_KEYS = ['Alt', 'Control', 'Shift', 'Meta'] as const;

export const SHORTCUT_SUPPORT_MESSAGE =
  'Use letters, numbers, Space, or F1-F12 with at least one modifier key';

export function isModifierOnlyKey(key: string): boolean {
  return MODIFIER_KEYS.includes(key as (typeof MODIFIER_KEYS)[number]);
}

export function normalizeShortcutKey(code: string): string | null {
  if (code === 'Space') {
    return 'Space';
  }

  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3);
  }

  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }

  if (/^F(?:[1-9]|1[0-2])$/.test(code)) {
    return code.toUpperCase();
  }

  return null;
}

export function getShortcutCandidate(
  event: ShortcutKeyboardEventLike
): ShortcutKeyInfo | null {
  if (isModifierOnlyKey(event.key)) {
    return null;
  }

  const key = normalizeShortcutKey(event.code);
  if (!key) {
    return null;
  }

  const modifiers: string[] = [];
  if (event.altKey) modifiers.push('Alt');
  if (event.ctrlKey) modifiers.push('Control');
  if (event.shiftKey) modifiers.push('Shift');
  if (event.metaKey) modifiers.push('Meta');

  return { modifiers, key };
}

export function validateShortcut(candidate: ShortcutKeyInfo): string | null {
  if (candidate.modifiers.length === 0) {
    return 'Please include a modifier key (Option, Control, Shift, or Command)';
  }

  return null;
}
