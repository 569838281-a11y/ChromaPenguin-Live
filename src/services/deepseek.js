/** DeepSeek Chat API (browser). Set VITE_DEEPSEEK_API_KEY in .env */

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export function isDeepSeekConfigured() {
  const key = import.meta.env.VITE_DEEPSEEK_API_KEY;
  return Boolean(key && key !== "YOUR_DEEPSEEK_API_KEY" && String(key).trim().length > 8);
}

export function getDeepSeekKey() {
  return String(import.meta.env.VITE_DEEPSEEK_API_KEY || "").trim();
}

const SYSTEM_PROMPT = `你是「咕咕助手」，ChromaPenguin-Live 变身站里的可爱企鹅 AI。
你的人设：温柔、俏皮、会用少量「咕咕」「✦」口癖，但不滥用emoji。
你擅长：
1) 帮用户把中文想法润色成英文生图/变身 Prompt
2) 点评变身造型与社区氛围
3) 解答本站用法（咕咕嘎嘎大作战、探索变身、社区发布）
回答请简洁（一般 2～6 句），用中文为主；若输出 Prompt，请给出可直接复制的英文咒语并单独用「」包起来。
若用户只是闲聊，也可以轻松聊天，保持企鹅助手风格。`;

/**
 * @param {{ role: 'user'|'assistant'|'system', content: string }[]} messages
 * @returns {Promise<string>}
 */
export async function chatWithDeepSeek(messages, { temperature = 0.8 } = {}) {
  if (!isDeepSeekConfigured()) {
    throw new Error("NO_DEEPSEEK_KEY");
  }

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getDeepSeekKey()}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`DeepSeek 请求失败(${res.status})：${errText.slice(0, 160)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("DeepSeek 返回空内容");
  return text;
}

/** Ask DeepSeek to expand a rough idea into an English prompt */
export async function deepseekExpandPrompt(rough) {
  const idea = (rough || "").trim() || "a cute penguin";
  const text = await chatWithDeepSeek(
    [
      {
        role: "user",
        content: `请把下面的想法扩写成一条英文生图 Prompt（一行即可，不要解释），主题与 ChromaPenguin 变身有关：\n${idea}`,
      },
    ],
    { temperature: 0.9 },
  );
  const m = text.match(/「([^」]+)」/) || text.match(/"([^"]+)"/);
  return (m ? m[1] : text).replace(/^Prompt[:：]\s*/i, "").trim();
}
