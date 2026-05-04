const RSS_SOURCES = [
  { name: "РБК", url: "https://rssexport.rbc.ru/rbcnews/news/30/full.rss" },
  { name: "Lenta.ru", url: "https://lenta.ru/rss" },
  { name: "РИА Новости", url: "https://ria.ru/export/rss2/archive/index.xml" },
  { name: "BBC", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  { name: "CNN", url: "http://rss.cnn.com/rss/edition.rss" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/" }
];

function proxiedUrl(url) {
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
}

function parseDate(raw) {
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
}

function dedupeNews(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.title.trim().toLowerCase();
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

function parseRss(xmlString, source) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, "text/xml");
  const items = [...xml.querySelectorAll("item")].map((item) => ({
    title: item.querySelector("title")?.textContent?.trim() || "",
    link: item.querySelector("link")?.textContent?.trim() || "",
    pubDate: parseDate(item.querySelector("pubDate")?.textContent),
    source
  }));
  return items.filter((item) => item.title);
}

export async function fetchAllNews(limit = 10) {
  const chunks = await Promise.allSettled(
    RSS_SOURCES.map(async (src) => {
      const response = await fetch(proxiedUrl(src.url));
      if (!response.ok) throw new Error(`Ошибка загрузки ${src.name}`);
      const xml = await response.text();
      return parseRss(xml, src.name);
    })
  );

  const loaded = chunks
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);

  const unique = dedupeNews(loaded);
  unique.sort((a, b) => b.pubDate - a.pubDate);
  return unique.slice(0, limit);
}
