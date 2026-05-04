import { analyzeHeadlines } from "./api.js";
import { fetchAllNews } from "./rss.js";
import { getSettings, saveSettings } from "./storage.js";
import { formatRelativeTime, renderSummary, renderTopicCards, show, showToast } from "./ui.js";

const state = {
  ...getSettings(),
  lastNews: []
};

const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

const el = {
  apiScreen: document.getElementById("apiScreen"),
  mainScreen: document.getElementById("mainScreen"),
  settingsScreen: document.getElementById("settingsScreen"),
  topicScreen: document.getElementById("topicScreen"),
  providerSelect: document.getElementById("providerSelect"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  saveApiBtn: document.getElementById("saveApiBtn"),
  analyzeNewsBtn: document.getElementById("analyzeNewsBtn"),
  summaryContent: document.getElementById("summaryContent"),
  updatedAt: document.getElementById("updatedAt"),
  topicInput: document.getElementById("topicInput"),
  analyzeTopicBtn: document.getElementById("analyzeTopicBtn"),
  savedTopicsList: document.getElementById("savedTopicsList"),
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  themeSelect: document.getElementById("themeSelect"),
  limitSelect: document.getElementById("limitSelect"),
  autoRefreshToggle: document.getElementById("autoRefreshToggle"),
  loader: document.getElementById("loader"),
  toast: document.getElementById("toast"),
  topicTitle: document.getElementById("topicTitle"),
  topicAnalysis: document.getElementById("topicAnalysis"),
  backToMainBtn: document.getElementById("backToMainBtn"),
  offlineBanner: document.getElementById("offlineBanner")
};

function applyTheme() {
  document.body.classList.toggle("dark-theme", state.theme === "dark");
}

function syncSettingsUI() {
  el.providerSelect.value = state.aiProvider;
  el.apiKeyInput.value = state.apiKey;
  el.themeSelect.value = state.theme;
  el.limitSelect.value = String(state.newsLimit);
  el.autoRefreshToggle.checked = state.autoRefresh;
}

function refreshSummaryUI() {
  el.updatedAt.textContent = formatRelativeTime(state.lastUpdated);
  renderSummary(el.summaryContent, state.lastNews, state.cachedSummary);
}

function refreshTopicsUI() {
  renderTopicCards(
    el.savedTopicsList,
    state.savedTopics,
    (topic) => openTopic(topic),
    (topic) => analyzeTopic(topic, true),
    (topic) => deleteTopic(topic)
  );
}

function isCacheValid() {
  return Boolean(state.lastUpdated && (Date.now() - state.lastUpdated < CACHE_TTL_MS));
}

function persistMainCache() {
  saveSettings({
    cachedSummary: state.cachedSummary,
    lastUpdated: state.lastUpdated
  });
}

function persistTopicsCache() {
  saveSettings({
    savedTopics: state.savedTopics.slice(0, 5),
    cachedTopics: state.cachedTopics
  });
}

async function analyzeMainNews(force = false) {
  if (!navigator.onLine) {
    show(el.offlineBanner, true);
    showToast(el.toast, "Нет интернета. Показан кэш.");
    refreshSummaryUI();
    return;
  }

  if (!force && isCacheValid() && state.cachedSummary) {
    refreshSummaryUI();
    return;
  }

  try {
    show(el.loader, true);
    state.lastNews = await fetchAllNews(state.newsLimit);
    const headlines = state.lastNews.map((item) => item.title);
    state.cachedSummary = await analyzeHeadlines({
      provider: state.aiProvider,
      apiKey: state.apiKey,
      headlines
    });
    state.lastUpdated = Date.now();
    persistMainCache();
    refreshSummaryUI();
  } catch (error) {
    showToast(el.toast, error.message || "Ошибка анализа новостей");
  } finally {
    show(el.loader, false);
  }
}

async function analyzeTopic(topic, force = false) {
  const trimmed = topic.trim();
  if (!trimmed) {
    showToast(el.toast, "Введите тему");
    return;
  }

  if (!navigator.onLine) {
    show(el.offlineBanner, true);
    openTopic(trimmed);
    return;
  }

  const cached = state.cachedTopics[trimmed];
  const isFresh = cached?.timestamp && (Date.now() - cached.timestamp < CACHE_TTL_MS);
  if (!force && isFresh) {
    openTopic(trimmed);
    return;
  }

  try {
    show(el.loader, true);
    const news = await fetchAllNews(state.newsLimit);
    const filtered = news.filter((n) => n.title.toLowerCase().includes(trimmed.toLowerCase()));
    const headlines = (filtered.length ? filtered : news).slice(0, state.newsLimit).map((n) => n.title);
    const result = await analyzeHeadlines({
      provider: state.aiProvider,
      apiKey: state.apiKey,
      headlines,
      topic: trimmed
    });
    state.cachedTopics[trimmed] = { ...result, timestamp: Date.now(), headlines };
    if (!state.savedTopics.includes(trimmed)) state.savedTopics.push(trimmed);
    state.savedTopics = state.savedTopics.slice(0, 5);
    persistTopicsCache();
    refreshTopicsUI();
    openTopic(trimmed);
  } catch (error) {
    showToast(el.toast, error.message || "Ошибка анализа темы");
  } finally {
    show(el.loader, false);
  }
}

function openTopic(topic) {
  const item = state.cachedTopics[topic];
  el.topicTitle.textContent = `Анализ темы: ${topic}`;
  if (!item) {
    el.topicAnalysis.innerHTML = "<p class='muted'>Нет данных по теме.</p>";
  } else {
    const list = (item.headlines || []).map((h) => `<li>${h}</li>`).join("");
    el.topicAnalysis.innerHTML = `
      <div class="news-item"><b>Кратко:</b> ${item.summary}</div>
      <div class="news-item"><b>Тональность:</b> ${item.sentiment}</div>
      <div class="news-item"><b>Ключевые темы:</b> ${(item.topics || []).join(", ") || "—"}</div>
      <div class="news-item"><b>Итог:</b> ${item.conclusion}</div>
      <div class="news-item"><b>Новости:</b><ol>${list}</ol></div>
    `;
  }
  show(el.mainScreen, false);
  show(el.settingsScreen, false);
  show(el.topicScreen, true);
}

function deleteTopic(topic) {
  state.savedTopics = state.savedTopics.filter((t) => t !== topic);
  delete state.cachedTopics[topic];
  persistTopicsCache();
  refreshTopicsUI();
}

function showMain() {
  show(el.topicScreen, false);
  show(el.settingsScreen, false);
  show(el.mainScreen, true);
}

function bindEvents() {
  el.saveApiBtn.addEventListener("click", () => {
    state.apiKey = el.apiKeyInput.value.trim();
    state.aiProvider = el.providerSelect.value;
    saveSettings({ apiKey: state.apiKey, aiProvider: state.aiProvider });
    show(el.apiScreen, false);
    showMain();
    showToast(el.toast, "Ключ сохранён");
  });

  el.analyzeNewsBtn.addEventListener("click", () => analyzeMainNews(true));
  el.analyzeTopicBtn.addEventListener("click", () => analyzeTopic(el.topicInput.value));
  el.backToMainBtn.addEventListener("click", showMain);

  el.openSettingsBtn.addEventListener("click", () => {
    show(el.mainScreen, false);
    show(el.topicScreen, false);
    show(el.settingsScreen, true);
  });
  el.closeSettingsBtn.addEventListener("click", showMain);

  el.themeSelect.addEventListener("change", () => {
    state.theme = el.themeSelect.value;
    saveSettings({ theme: state.theme });
    applyTheme();
  });

  el.limitSelect.addEventListener("change", () => {
    state.newsLimit = Number(el.limitSelect.value);
    saveSettings({ newsLimit: state.newsLimit });
  });

  el.autoRefreshToggle.addEventListener("change", () => {
    state.autoRefresh = el.autoRefreshToggle.checked;
    saveSettings({ autoRefresh: state.autoRefresh });
  });

  window.addEventListener("online", () => show(el.offlineBanner, false));
  window.addEventListener("offline", () => show(el.offlineBanner, true));
}

async function init() {
  applyTheme();
  syncSettingsUI();
  refreshTopicsUI();
  refreshSummaryUI();
  bindEvents();

  if (!state.apiKey) {
    show(el.apiScreen, true);
    show(el.mainScreen, false);
    return;
  }

  show(el.apiScreen, false);
  showMain();

  if (!navigator.onLine) show(el.offlineBanner, true);
  if (state.cachedSummary) refreshSummaryUI();
  if (state.autoRefresh || !state.cachedSummary || !isCacheValid()) {
    await analyzeMainNews(false);
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {
    // silent fail for unsupported environments
  });
}

init();
