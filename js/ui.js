export function show(el, visible = true) {
  el.classList.toggle("hidden", !visible);
}

export function showToast(toast, message) {
  toast.textContent = message;
  show(toast, true);
  setTimeout(() => show(toast, false), 2600);
}

export function renderSummary(container, newsItems, analysis) {
  if (!analysis) {
    container.innerHTML = "<p class='muted'>Нет данных. Запустите анализ.</p>";
    return;
  }

  const items = newsItems.slice(0, 10).map((item) => (
    `<div class="news-item"><b>${item.source}</b>: ${item.title}</div>`
  )).join("");

  container.innerHTML = `
    <div>${items}</div>
    <div class="news-item"><b>Сводка:</b> ${analysis.summary}</div>
    <div class="news-item"><b>Тональность:</b> ${analysis.sentiment}</div>
    <div class="news-item"><b>Ключевые темы:</b> ${(analysis.topics || []).join(", ") || "—"}</div>
    <div class="news-item"><b>Вывод:</b> ${analysis.conclusion}</div>
  `;
}

export function renderTopicCards(container, topics, onOpen, onRefresh, onDelete) {
  container.innerHTML = "";
  if (!topics.length) {
    container.innerHTML = "<p class='muted'>Сохранённых тем пока нет.</p>";
    return;
  }

  topics.forEach((topic) => {
    const card = document.createElement("article");
    card.className = "topic-card";
    card.innerHTML = `
      <button class="ghost topic-open">${topic}</button>
      <div class="actions">
        <button class="ghost topic-refresh">Обновить</button>
        <button class="ghost topic-delete">Удалить</button>
      </div>
    `;

    let touchStartX = 0;
    card.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
    });
    card.addEventListener("touchend", (e) => {
      const delta = touchStartX - e.changedTouches[0].screenX;
      if (delta > 80) onDelete(topic);
    });

    card.querySelector(".topic-open").addEventListener("click", () => onOpen(topic));
    card.querySelector(".topic-refresh").addEventListener("click", () => onRefresh(topic));
    card.querySelector(".topic-delete").addEventListener("click", () => onDelete(topic));
    container.appendChild(card);
  });
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return "Обновлено: никогда";
  const diffMin = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
  return `Обновлено ${diffMin} минут назад`;
}
