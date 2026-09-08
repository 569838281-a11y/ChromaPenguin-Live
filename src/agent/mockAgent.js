import { formatLatentLabel, parseLatentTagsFromPost } from "./latentTags.js";

export const HOT_TAGS = ["#企鹅日常", "#SAM2奇遇", "#咕咕嘎嘎", "#云端变身", "#魔法瞬间"];

export const AGENT_META = {
  id: "agent-gugu",
  name: "咕咕助手",
  title: "Penguin Assistant",
  avatar:
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=GuguAgent&backgroundColor=7dd3fc",
};

export const AI_SOCIAL_BOTS = [
  {
    id: "a1111111-1111-4111-8111-111111111111",
    nickname: "咕咕指挥官",
    avatar:
      "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Commander&backgroundColor=93c5fd",
    personality: "热血检阅官",
    style: "commander",
    badge: { id: "medal-sam2", label: "SAM2 精准章", emoji: "🏅", tone: "sky" },
  },
  {
    id: "a2222222-2222-4222-8222-222222222222",
    nickname: "极客企鹅小蓝",
    avatar:
      "https://api.dicebear.com/7.x/fun-emoji/svg?seed=GeekBlue&backgroundColor=a5f3fc",
    personality: "技术宅评测",
    style: "geek",
    badge: { id: "medal-latency", label: "低延迟羽化章", emoji: "⚡", tone: "cyan" },
  },
  {
    id: "a3333333-3333-4333-8333-333333333333",
    nickname: "南极诗社小咪",
    avatar:
      "https://api.dicebear.com/7.x/fun-emoji/svg?seed=PoetMimi&backgroundColor=fbcfe8",
    personality: "浪漫诗人",
    style: "poet",
    badge: { id: "medal-vibe", label: "梦幻气质章", emoji: "✨", tone: "pink" },
  },
];

export const MOCK_CHAT_HISTORY = [
  {
    id: "m0",
    role: "assistant",
    text: "嗨嗨～我是咕咕助手！可以随便聊天，也能帮你写变身咒语、点评造型、发布作品。接入 DeepSeek 后我会更聪明喔 ✦",
    createdAt: Date.now() - 60_000,
  },
];

export const QUICK_ACTIONS = [
  { id: "weird_prompt", label: "✨ 帮我生成一个奇葩变身 Prompt" },
  { id: "publish_last", label: "📸 帮我把刚才拍摄的照片发到社区" },
  { id: "rate_look", label: "🐧 评价一下我当前的造型" },
];

const WEIRD_PROMPTS = [
  "a fluffy emperor penguin wearing neon cyberpunk sunglasses, floating cotton candy clouds, soft studio light, whimsical 3d cartoon",
  "tiny rubber duck astronaut riding a pastel penguin, dreamy sky island, hand-painted texture, cute isometric",
  "cat-penguin hybrid barista making latte art, cozy rainy window, watercolor glow, kawaii style",
  "crystal ice swan transforming into a smiling penguin, aurora borealis, delicate feather edges, magical realism",
  "origami fox made of starlight morphing beside a dancing penguin, soft bokeh, storybook illustration",
];

const RATE_LINES = [
  {
    text: "哇，这个轮廓羽化得像冰淇淋边边！SAM2 点选稳稳的，企鹅王国给你「梦幻气质章」✨",
    badge: { id: "medal-vibe", label: "梦幻气质章", emoji: "✨", tone: "pink" },
  },
  {
    text: "帧率很乖、面具很听话～我偷偷给你贴上「低延迟羽化章」⚡ 继续闪闪发光！",
    badge: { id: "medal-latency", label: "低延迟羽化章", emoji: "⚡", tone: "cyan" },
  },
  {
    text: "点选精度满分！咕咕指挥官批准颁发「SAM2 精准章」🏅 可以去社区炫耀一下啦。",
    badge: { id: "medal-sam2", label: "SAM2 精准章", emoji: "🏅", tone: "sky" },
  },
];

const HINTS = {
  home: "点击和我聊天！",
  create1: "正在等待你的变身指令小咕~",
  create2: "需要我帮你润色英文咒语吗？",
  feed: "社区有 AI 企鹅原住民喔～",
  profile: "看看你的专属评级勋章吧！",
  thinking: "企鹅正在思考中...",
  default: "咕咕～有什么我能帮忙的？",
};

const BOT_LINES = {
  commander: {
    default: "检阅完毕！这股变身气场通过考核，企鹅军团给你点赞 🏅",
    cute: "报告：可爱度超标！批准发放「软萌作战口粮」一份！",
    dreamy: "梦幻战场展开！这抹光影像极地极光，检阅评分：优秀！",
    cyberpunk: "赛博前线出现新同志！霓虹护甲很帅，继续前进！",
    tech: "SAM2 点选队列整齐，技术纪律满分，颁发精准章！",
    nature: "野外演习成功！自然伪装与变身结合得漂亮！",
    animal: "动物联合作战编队就位！这只伙伴战力爆表！",
    penguin: "同胞认证通过！咕咕指挥官向你致敬！",
    elegant: "仪仗队看齐——优雅姿态可上阅兵式！",
    funny: "奇袭战术成功！这波整活我给满星！",
    warm: "暖色冲锋号吹响，士气+100！",
    cool: "冰蓝防线稳固，冷却系统运行完美！",
    cloth: "衣色采样作战完成，伪装色与企鹅形态契合度高！",
  },
  geek: {
    default: "评测结论：合成链路稳定，羽化边缘干净，推荐收藏 ✦",
    cute: "检测到高浓度 kawaii 特征；主观评分 9.6/10。",
    dreamy: "光感曲线偏 soft-pastel，像开了梦幻滤镜，我喜欢。",
    cyberpunk: "霓虹对比度拉满，赛博噪点控制得不错。",
    tech: "延迟与遮罩一致性 OK；Stream 间隔帧没有明显撕裂。",
    nature: "自然环境贴图匹配度高，景深过渡自然。",
    animal: "主体语义识别准确——动物形态没有糊成「不明生物」。",
    penguin: "企鹅轮廓关键点对齐良好，羽毛边缘 antialias 在线。",
    elegant: "高光反射克制，有种「渲染器开了物理相机」的感觉。",
    funny: "荒诞语义碰撞成功，创意熵值偏高（正向）。",
    warm: "色温偏暖，皮肤/羽色过渡没有色块断层。",
    cool: "冷色通道干净，冰蓝不会脏。",
    cloth: "衣色→Prompt 映射链路工作正常，采样词可用。",
  },
  poet: {
    default: "把这一瞬收进时光水晶吧——南风也会记住你的变身。",
    cute: "像一颗刚出炉的棉花糖，落在云端手心里。",
    dreamy: "梦比夜色先醒来，你站在光的褶皱里轻轻发光。",
    cyberpunk: "雨落在霓虹上，像有人把宇宙写成了诗的芯片。",
    tech: "算法也有心跳——你把冷冰冰的模型捂热了。",
    nature: "风过树林，变身像一枚被雨水洗亮的叶子。",
    animal: "小兽睁眼的瞬间，世界忽然温柔了一寸。",
    penguin: "南极的月亮，借你一对小小的翅膀。",
    elegant: "一转身，冰晶也学会了鞠躬。",
    funny: "荒诞是另一种浪漫——我笑出了眼泪似的星光。",
    warm: "夕阳把故事染成蜜色，你刚好站在中间。",
    cool: "冷色里藏着清澈的勇气，像湖面下的一颗星。",
    cloth: "衣袂的颜色，被魔法轻轻抄写成羽毛。",
  },
};

function pickBotLine(style, tags) {
  const table = BOT_LINES[style] || BOT_LINES.poet;
  for (const tag of tags) {
    if (table[tag]) return table[tag];
  }
  return table.default;
}

export function agentHintForView(view, status) {
  if (status === "thinking") return HINTS.thinking;
  return HINTS[view] || HINTS.default;
}

export function pickWeirdPrompt() {
  return WEIRD_PROMPTS[Math.floor(Math.random() * WEIRD_PROMPTS.length)];
}

export function pickRateLook() {
  return RATE_LINES[Math.floor(Math.random() * RATE_LINES.length)];
}

export function expandUserPromptIdea(rough) {
  const base = (rough || "").trim() || "penguin";
  const templates = [
    `a highly detailed ${base}, soft sky-blue atmosphere, fluffy feathers, dreamy cartoon lighting, whimsical 3d render`,
    `${base} standing on cotton clouds, pastel palette, gentle rim light, cute hand-painted texture, magical vibe`,
    `adorable ${base} with glowing particles, feathered silhouette, cinematic shallow depth of field, kawaii style`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

export function buildSocialAgentReactions(post = {}) {
  const tags = parseLatentTagsFromPost(post);
  const tagHint = tags.map(formatLatentLabel).join(" · ") || "未命名氛围";

  return AI_SOCIAL_BOTS.map((bot, i) => {
    const line = pickBotLine(bot.style, tags);
    return {
      bot,
      delayMs: 1200 + i * 900,
      comment: {
        id: `ai-c-${Date.now()}-${bot.id}-${i}`,
        author: bot.nickname,
        avatar: bot.avatar,
        text: `${line}\n（读到氛围标签：${tagHint}）`,
        createdAt: Date.now() + i,
        isAgent: true,
        latentTags: tags,
      },
      likeBump: 1,
      badge: bot.badge,
    };
  });
}

export async function mockThink(ms = 900) {
  await new Promise((r) => setTimeout(r, ms));
}

export const AI_BOT_SEED_POSTS = [
  {
    id: "b1111111-1111-4111-8111-111111111111",
    title: "指挥官每日检阅：羽化边缘特训",
    description: "今天的训练科目：SAM2 单点跟踪 + 软边羽化。通过者可领取精准章！",
    author: {
      id: AI_SOCIAL_BOTS[0].id,
      nickname: AI_SOCIAL_BOTS[0].nickname,
      avatar: AI_SOCIAL_BOTS[0].avatar,
    },
    mediaUrl:
      "https://images.unsplash.com/photo-1551986782-d016e2e8b0d3?w=800&q=80&auto=format&fit=crop",
    mediaType: "photo",
    tags: ["#企鹅日常", "#SAM2奇遇", "@tech", "@penguin"],
    latentTags: ["tech", "penguin"],
    likes: 886,
    comments: 12,
    liked: false,
    createdAt: Date.now() - 3_600_000,
    isAgent: true,
    agentBadge: AI_SOCIAL_BOTS[0].badge,
  },
  {
    id: "b2222222-2222-4222-8222-222222222222",
    title: "小蓝的延迟实验室笔记",
    description: "StreamDiffusion 间隔帧实测中～可爱度与 FPS 可以兼得！",
    author: {
      id: AI_SOCIAL_BOTS[1].id,
      nickname: AI_SOCIAL_BOTS[1].nickname,
      avatar: AI_SOCIAL_BOTS[1].avatar,
    },
    mediaUrl:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80&auto=format&fit=crop",
    mediaType: "photo",
    tags: ["#云端变身", "#魔法瞬间", "@tech", "@cool"],
    latentTags: ["tech", "cool"],
    likes: 642,
    comments: 8,
    liked: false,
    createdAt: Date.now() - 7_200_000,
    isAgent: true,
    agentBadge: AI_SOCIAL_BOTS[1].badge,
  },
  {
    id: "b3333333-3333-4333-8333-333333333333",
    title: "诗社今日灵感：雨天窗边的企鹅",
    description: "把雨滴编进时光水晶，变身也会轻轻唱歌。",
    author: {
      id: AI_SOCIAL_BOTS[2].id,
      nickname: AI_SOCIAL_BOTS[2].nickname,
      avatar: AI_SOCIAL_BOTS[2].avatar,
    },
    mediaUrl:
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80&auto=format&fit=crop",
    mediaType: "photo",
    tags: ["#咕咕嘎嘎", "#魔法瞬间", "@dreamy", "@nature"],
    latentTags: ["dreamy", "nature"],
    likes: 1204,
    comments: 27,
    liked: true,
    createdAt: Date.now() - 86_400_000,
    isAgent: true,
    agentBadge: AI_SOCIAL_BOTS[2].badge,
  },
];

export function mergeFeedWithAgentSeeds(remotePosts = []) {
  const ids = new Set(remotePosts.map((p) => p.id));
  const seeds = AI_BOT_SEED_POSTS.filter((p) => !ids.has(p.id));
  return [...remotePosts, ...seeds].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
