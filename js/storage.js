const STORAGE_KEYS = {
  apiKey: "apiKey",
  aiProvider: "aiProvider",
  theme: "theme",
  savedTopics: "savedTopics",
  cachedSummary: "cachedSummary",
  cachedTopics: "cachedTopics",
  lastUpdated: "lastUpdated",
  newsLimit: "newsLimit",
  autoRefresh: "autoRefresh"
};

export function getValue(key, fallback = null) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function setValue(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getSettings() {
  return {
    apiKey: getValue(STORAGE_KEYS.apiKey, ""),
    aiProvider: getValue(STORAGE_KEYS.aiProvider, "openai"),
    theme: getValue(STORAGE_KEYS.theme, "light"),
    savedTopics: getValue(STORAGE_KEYS.savedTopics, []),
    cachedSummary: getValue(STORAGE_KEYS.cachedSummary, null),
    cachedTopics: getValue(STORAGE_KEYS.cachedTopics, {}),
    lastUpdated: getValue(STORAGE_KEYS.lastUpdated, null),
    newsLimit: Number(getValue(STORAGE_KEYS.newsLimit, 10)),
    autoRefresh: Boolean(getValue(STORAGE_KEYS.autoRefresh, false))
  };
}

export function saveSettings(partial) {
  Object.entries(partial).forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(STORAGE_KEYS, key)) {
      setValue(STORAGE_KEYS[key], value);
    }
  });
}

export { STORAGE_KEYS };
