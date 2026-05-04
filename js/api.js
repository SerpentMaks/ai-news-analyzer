// Браузерный fetch на внешние API без своего backend
// блокируется CORS → «Failed to fetch». Обходим тем же приёмом, что и для RSS.
const CHAT_CORS_PROXY = "https://corsproxy.io/?url=";

function formatProviderHttpError(label, status, bodyText) {
  const short = (bodyText || "").trim().slice(0, 400);
  let apiMsg = "";
  try {
    const j = JSON.parse(short);
    apiMsg = j.error?.message || j.message || "";
  } catch {
    // ignore
  }
  const lower = apiMsg.toLowerCase();
  if (lower.includes("insufficient balance")) {
    return `${label}: на счёте недостаточно средств. Пополните баланс в кабинете провайдера API.`;
  }
  if (lower.includes("incorrect api key") || lower.includes("invalid api key")) {
    return `${label}: неверный или отозванный API-ключ.`;
  }
  if (apiMsg) return `${label}: ${apiMsg}`;
  if (short) return `${label} (${status}): ${short}`;
  return `${label} недоступен (HTTP ${status}).`;
}

function parseAiText(text) {
  const fallback = {
    summary: text.slice(0, 300),
    sentiment: "нейтрально",
    topics: [],
    conclusion: "Недостаточно данных для подробного вывода."
  };

  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return { ...fallback, ...JSON.parse(clean) };
  } catch {
    return fallback;
  }
}

async function callChatCompletions(apiKey, baseUrl, model, prompt, labelForErrors) {
  const targetUrl = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  const fetchUrl = CHAT_CORS_PROXY + encodeURIComponent(targetUrl);
  let res;
  try {
    res = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Ты анализируешь новости и возвращаешь только JSON."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.3
      })
    });
  } catch (e) {
    const msg = e instanceof TypeError ? e.message : String(e);
    throw new Error(
      `Запрос к ИИ не прошёл (${msg}). Проверьте интернет или попробуйте позже.`
    );
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(formatProviderHttpError(labelForErrors.replace(" API", ""), res.status, errText));
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callHuggingFace(apiKey, prompt) {
  const res = await fetch("https://api-inference.huggingface.co/models/google/flan-t5-large", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ inputs: prompt })
  });
  if (!res.ok) throw new Error("Hugging Face API недоступен");
  const data = await res.json();
  if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text;
  return JSON.stringify(data);
}

export async function analyzeHeadlines({ provider, apiKey, headlines, topic = null }) {
  if (!apiKey) throw new Error("Сначала сохраните API ключ");
  const topicText = topic ? `Тема: ${topic}` : "Сделай общую мини-сводку по миру и России.";
  const prompt = [
    topicText,
    "Проанализируй заголовки и верни JSON:",
    '{"summary":"...","sentiment":"позитив|нейтрально|негатив","topics":["..."],"conclusion":"..."}',
    "Заголовки:",
    headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")
  ].join("\n");

  let raw;
  if (provider === "huggingface") {
    raw = await callHuggingFace(apiKey, prompt);
  } else if (provider === "deepseek") {
    raw = await callChatCompletions(
      apiKey,
      "https://api.deepseek.com",
      "deepseek-chat",
      prompt,
      "DeepSeek API"
    );
  } else if (provider === "groq") {
    raw = await callChatCompletions(
      apiKey,
      "https://api.groq.com/openai",
      "llama-3.3-70b-versatile",
      prompt,
      "Groq API"
    );
  } else {
    raw = await callChatCompletions(
      apiKey,
      "https://api.openai.com",
      "gpt-4o-mini",
      prompt,
      "OpenAI API"
    );
  }

  return parseAiText(raw);
}
