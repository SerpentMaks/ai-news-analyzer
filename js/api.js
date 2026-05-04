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

async function callOpenAI(apiKey, prompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
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
  if (!res.ok) throw new Error("OpenAI API недоступен");
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

  const raw = provider === "huggingface"
    ? await callHuggingFace(apiKey, prompt)
    : await callOpenAI(apiKey, prompt);

  return parseAiText(raw);
}
