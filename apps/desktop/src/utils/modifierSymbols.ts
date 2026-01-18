/**
 * Maps keyboard modifier keys to their macOS symbol equivalents.
 */
export function getModifierSymbol(modifier: string): string {
  switch (modifier.toLowerCase()) {
    case 'alt':
    case 'option':
      return '\u2325';
    case 'ctrl':
    case 'control':
      return '\u2303';
    case 'shift':
      return '\u21E7';
    case 'meta':
    case 'cmd':
    case 'command':
      return '\u2318';
    default:
      return modifier;
  }
}

/**
 * Creates a display string from modifiers and key (e.g., "Option Space").
 */
export function getModifierDisplay(modifiers: string[]): { symbol: string; label: string }[] {
  return modifiers.map((mod) => {
    switch (mod.toLowerCase()) {
      case 'alt':
      case 'option':
        return { symbol: '\u2325', label: 'Option' };
      case 'ctrl':
      case 'control':
        return { symbol: '\u2303', label: 'Control' };
      case 'shift':
        return { symbol: '\u21E7', label: 'Shift' };
      case 'meta':
      case 'cmd':
      case 'command':
        return { symbol: '\u2318', label: 'Command' };
      default:
        return { symbol: mod, label: mod };
    }
  });
}

/**
 * Creates a compact display string from modifiers and key.
 */
export function getDisplayString(modifiers: string[], key: string): string {
  const modSymbols = modifiers.map(getModifierSymbol);
  return [...modSymbols, key].join(' ');
}
