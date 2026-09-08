/**
 * Latent (implicit) tags derived from generation prompts.
 * Stored on posts as tags like "@dreamy" — bots read them; UI can show softly.
 */

export const LATENT_TAG_META = {
  cute: { label: "软萌", emoji: "🫧" },
  dreamy: { label: "梦幻", emoji: "✨" },
  cyberpunk: { label: "赛博", emoji: "neon" },
  tech: { label: "极客", emoji: "⚡" },
  nature: { label: "自然", emoji: "🌿" },
  animal: { label: "萌宠", emoji: "🐾" },
  penguin: { label: "企鹅", emoji: "🐧" },
  elegant: { label: "优雅", emoji: "🦢" },
  funny: { label: "搞怪", emoji: "🤪" },
  warm: { label: "暖色", emoji: "🌅" },
  cool: { label: "冷色", emoji: "❄️" },
  cloth: { label: "衣色变身", emoji: "👕" },
};

/**
 * Keyword rules: matched against genPrompt (preferred), else title/description.
 * Order does not matter; up to 4 tags are kept.
 */
const RULES = [
  { tag: "cute", re: /cute|kawaii|fluffy|adorable|软萌|可爱|萌萌|棉花糖|chibi|毛茸/i },
  {
    tag: "dreamy",
    re: /dreamy|dreamlike|pastel|magical|whimsical|梦幻|aurora|fairy|soft\s+\w*\s*light|云朵|云端变身|棉花云/i,
  },
  { tag: "cyberpunk", re: /cyber|neon|futur|赛博|科幻|hologram|matrix|霓虹/i },
  { tag: "tech", re: /tech|robot|mecha|circuit|低延迟|fps|sam2|stream|机械/i },
  { tag: "nature", re: /forest|ocean|beach|mountain|花园|海边|雨天|snow|garden|树林|雪山/i },
  { tag: "animal", re: /cat|dog|duck|fox|兔|猫|狗|bird|otter|bunny|小动物/i },
  { tag: "penguin", re: /penguin|企鹅|咕咕|emperor\s*penguin/i },
  { tag: "elegant", re: /elegant|swan|crystal|silk|ballet|高雅|冰晶|优雅/i },
  { tag: "funny", re: /funny|weird|absurd|rubber|奇葩|搞笑|meme|duck astronaut|整活/i },
  { tag: "warm", re: /warm|sunset|orange|pink|金色|日落|cozy|暖色|夕阳/i },
  { tag: "cool", re: /cool|blue|ice|cyan|冷色|冰蓝|winter|冰雪/i },
  { tag: "cloth", re: /cloth|衣色|衣服颜色|color\s*transform|采样/i },
];

/** @returns {string[]} bare tag ids e.g. ['dreamy','penguin'] */
export function deriveLatentTags(genPrompt = "", { mode } = {}) {
  const text = String(genPrompt || "").trim();
  const found = [];

  for (const rule of RULES) {
    if (rule.re.test(text) && !found.includes(rule.tag)) found.push(rule.tag);
  }

  // Mode1 (咕咕嘎嘎衣色变身): always carry cloth + penguin when possible
  if (mode === "create1") {
    if (!found.includes("cloth")) found.unshift("cloth");
    if (!found.includes("penguin")) found.push("penguin");
  }

  // Richer defaults when nothing matched (avoid a single misleading tag)
  if (!found.length) {
    if (mode === "create1") found.push("cloth", "penguin", "cute");
    else if (mode === "create2") found.push("dreamy", "penguin", "cute");
    else found.push("penguin", "cute");
  }

  return found.slice(0, 4);
}

export function toLatentTagTokens(latentTags = []) {
  return latentTags.map((t) => `@${t}`);
}

export function parseLatentTagsFromPost(post) {
  if (Array.isArray(post?.latentTags) && post.latentTags.length) return post.latentTags;

  const fromTags = (post?.tags || [])
    .map((t) => String(t))
    .filter((t) => t.startsWith("@"))
    .map((t) => t.slice(1))
    .filter((t) => LATENT_TAG_META[t]);

  if (fromTags.length) return fromTags;

  // Prefer real gen prompt; avoid deriving only from marketing copy like「云端变身」
  const promptish = post?.genPrompt || "";
  if (promptish.trim()) {
    return deriveLatentTags(promptish, { mode: post?.mode });
  }

  return deriveLatentTags("", { mode: post?.mode });
}

export function mergePublicAndLatentTags(publicTags = [], latentTags = []) {
  const pub = (publicTags || []).filter((t) => t && !String(t).startsWith("@"));
  const latent = toLatentTagTokens(latentTags);
  return [...pub, ...latent];
}

export function visibleTagsOnly(tags = []) {
  return (tags || []).filter((t) => t && !String(t).startsWith("@"));
}

export function formatLatentLabel(tag) {
  const meta = LATENT_TAG_META[tag];
  if (!meta) return tag;
  return `${meta.emoji === "neon" ? "🔮" : meta.emoji} ${meta.label}`;
}
