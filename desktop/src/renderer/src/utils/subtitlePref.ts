// Remembers the user's chosen subtitle language so it persists across reloads
// and episodes (the player otherwise resets to no selection every mount, which
// previously fell back to the first/frequently-Arabic track). Stored as a BCP-47
// language code, or the sentinel "off" when the user explicitly disabled captions.

const KEY = "mellow:subtitlePref";

export function loadSubtitlePref(): string | null {
  try {
    return localStorage.getItem(KEY); // "off" | lang code | null
  } catch {
    return null;
  }
}

export function saveSubtitlePref(value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, value);
  } catch {
    /* storage unavailable — preferences just won't persist */
  }
}
