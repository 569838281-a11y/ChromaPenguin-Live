import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AGENT_META,
  MOCK_CHAT_HISTORY,
  QUICK_ACTIONS,
  agentHintForView,
  buildSocialAgentReactions,
  expandUserPromptIdea,
  mockThink,
  pickRateLook,
  pickWeirdPrompt,
} from "./mockAgent.js";
import {
  chatWithDeepSeek,
  deepseekExpandPrompt,
  isDeepSeekConfigured,
} from "../services/deepseek.js";

const AgentContext = createContext(null);

function uid(prefix = "m") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function toApiMessages(msgs, limit = 12) {
  return msgs
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => String(m.text || m.fullText || "").trim())
    .slice(-limit)
    .map((m) => ({
      role: m.role,
      content: String(m.fullText || m.text || "").trim(),
    }));
}

export function AgentProvider({
  children,
  currentView,
  lastCapture,
  onRequestPublish,
  onNavigate,
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("online"); // online | thinking
  const [messages, setMessages] = useState(MOCK_CHAT_HISTORY);
  const [badges, setBadges] = useState([]);
  const promptSetterRef = useRef(null);
  const pendingPromptRef = useRef(null);
  const typeTimersRef = useRef([]);
  const messagesRef = useRef(messages);
  const deepseekOn = isDeepSeekConfigured();

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const hint = useMemo(
    () => agentHintForView(currentView, status),
    [currentView, status],
  );

  useEffect(() => {
    return () => {
      typeTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const applyPromptFill = useCallback((prompt) => {
    if (!prompt) return;
    if (promptSetterRef.current) {
      promptSetterRef.current(prompt);
      pendingPromptRef.current = null;
    } else {
      pendingPromptRef.current = prompt;
    }
  }, []);

  const registerPromptSetter = useCallback((fn) => {
    promptSetterRef.current = fn;
    if (pendingPromptRef.current && fn) {
      fn(pendingPromptRef.current);
      pendingPromptRef.current = null;
    }
    return () => {
      if (promptSetterRef.current === fn) promptSetterRef.current = null;
    };
  }, []);

  const pushBadge = useCallback((badge) => {
    if (!badge) return;
    setBadges((prev) => {
      if (prev.some((b) => b.id === badge.id)) return prev;
      return [badge, ...prev];
    });
  }, []);

  const appendAssistantTyped = useCallback((fullText, extra = {}) => {
    const id = uid("a");
    setMessages((prev) => [
      ...prev,
      { id, role: "assistant", text: "", fullText, typing: true, createdAt: Date.now(), ...extra },
    ]);

    let i = 0;
    const step = () => {
      i += 1;
      const slice = fullText.slice(0, i);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                text: slice,
                typing: i < fullText.length,
              }
            : m,
        ),
      );
      if (i < fullText.length) {
        const t = setTimeout(step, 12 + Math.random() * 18);
        typeTimersRef.current.push(t);
      } else {
        setStatus("online");
      }
    };
    const t0 = setTimeout(step, 40);
    typeTimersRef.current.push(t0);
    return id;
  }, []);

  const thinkThenReply = useCallback(
    async (fullText, extra = {}) => {
      setStatus("thinking");
      await mockThink(500 + Math.random() * 400);
      appendAssistantTyped(fullText, extra);
    },
    [appendAssistantTyped],
  );

  const replyWithDeepSeek = useCallback(
    async (userText) => {
      setStatus("thinking");
      try {
        const history = toApiMessages([
          ...messagesRef.current,
          { role: "user", text: userText },
        ]);
        const answer = await chatWithDeepSeek(history);
        appendAssistantTyped(answer);
      } catch (err) {
        const msg = err?.message || "";
        if (msg === "NO_DEEPSEEK_KEY") {
          appendAssistantTyped(
            "咕咕～我还没接到 DeepSeek 钥匙。请在项目根目录 `.env` 里设置 `VITE_DEEPSEEK_API_KEY` 后重启前端，就能自由聊天啦。\n\n现在也可以：① 生成/润色变身 Prompt ② 发布刚才拍摄 ③ 点评造型。",
          );
          return;
        }
        appendAssistantTyped(`刚才脑子咕了一下：${msg.slice(0, 120)}\n\n你可以换个说法再试，或用下面的快捷指令～`);
      }
    },
    [appendAssistantTyped],
  );

  const expandPromptSmart = useCallback(async (rough, { weird = false } = {}) => {
    if (weird) return pickWeirdPrompt();
    if (deepseekOn) {
      try {
        return await deepseekExpandPrompt(rough);
      } catch {
        /* fall through */
      }
    }
    return expandUserPromptIdea(rough);
  }, [deepseekOn]);

  const sendUserMessage = useCallback(
    async (raw) => {
      const text = String(raw || "").trim();
      if (!text) return;

      setMessages((prev) => [
        ...prev,
        { id: uid("u"), role: "user", text, createdAt: Date.now() },
      ]);
      setOpen(true);

      const lower = text.toLowerCase();
      if (/prompt|咒语|变身|变成|生成/.test(text) || lower.includes("prompt")) {
        const rough =
          text.replace(/帮我|生成|优化|润色|咒语|prompt|变身|变成/gi, "").trim() || text;
        const weird = /奇葩|crazy|weird|随机/.test(text);
        setStatus("thinking");
        const prompt = await expandPromptSmart(rough, { weird });
        onNavigate?.("create2");
        appendAssistantTyped(
          `收到！我把你的想法扩写成英文咒语啦，已尝试填入探索变身输入框～\n\n「${prompt}」\n\n不满意可以再跟我说「再来一个」。`,
          { promptFill: prompt },
        );
        applyPromptFill(prompt);
        return;
      }

      if (/发布|社区|分享|发帖/.test(text)) {
        if (!lastCapture) {
          await thinkThenReply("我还没看到刚拍的作品喔～先去创作页咔嚓一张，再叫我帮你发布！");
          return;
        }
        await thinkThenReply("好的！正在打开发布面板，把这份魔法送去变身社区～");
        onRequestPublish?.(lastCapture);
        return;
      }

      if (/评价|点评|造型|好看|勋章/.test(text)) {
        const rated = pickRateLook();
        pushBadge(rated.badge);
        await thinkThenReply(rated.text, { badge: rated.badge });
        return;
      }

      // Free-form chat via DeepSeek (or friendly fallback)
      await replyWithDeepSeek(text);
    },
    [
      lastCapture,
      onNavigate,
      onRequestPublish,
      pushBadge,
      thinkThenReply,
      applyPromptFill,
      expandPromptSmart,
      appendAssistantTyped,
      replyWithDeepSeek,
    ],
  );

  const runQuickAction = useCallback(
    async (actionId) => {
      setOpen(true);
      const label = QUICK_ACTIONS.find((a) => a.id === actionId)?.label || actionId;
      setMessages((prev) => [
        ...prev,
        { id: uid("u"), role: "user", text: label, createdAt: Date.now() },
      ]);

      if (actionId === "weird_prompt") {
        setStatus("thinking");
        const prompt = await expandPromptSmart("weird surreal cute penguin transformation", {
          weird: true,
        });
        onNavigate?.("create2");
        appendAssistantTyped(`奇葩咒语生成完毕！已填入探索变身输入框 ✦\n\n「${prompt}」`, {
          promptFill: prompt,
        });
        applyPromptFill(prompt);
        return;
      }

      if (actionId === "publish_last") {
        if (!lastCapture) {
          await thinkThenReply("还没有可发布的拍摄喔～先去「咕咕嘎嘎」或「探索变身」留下魔法瞬间吧！");
          return;
        }
        await thinkThenReply("收到！打开发布面板中～社区的 AI 企鹅原住民可能会来围观哦。");
        onRequestPublish?.(lastCapture);
        return;
      }

      if (actionId === "rate_look") {
        const rated = pickRateLook();
        pushBadge(rated.badge);
        await thinkThenReply(rated.text, { badge: rated.badge });
      }
    },
    [
      lastCapture,
      onNavigate,
      onRequestPublish,
      pushBadge,
      thinkThenReply,
      applyPromptFill,
      expandPromptSmart,
      appendAssistantTyped,
    ],
  );

  /** Create views: ask agent opinion */
  const askAgentOpinion = useCallback(
    async (mode = "create1") => {
      setOpen(true);
      setMessages((prev) => [
        ...prev,
        {
          id: uid("u"),
          role: "user",
          text: mode === "create2" ? "帮我看看这个变身咒语和点选怎么样？" : "评价一下我当前的变身造型～",
          createdAt: Date.now(),
        },
      ]);
      const rated = pickRateLook();
      pushBadge(rated.badge);
      await thinkThenReply(
        mode === "create2"
          ? `${rated.text}\n\n小提示：点选尽量落在目标中心，英文咒语可以写得更具体一点～`
          : rated.text,
        { badge: rated.badge },
      );
    },
    [pushBadge, thinkThenReply],
  );

  /** Optimize rough prompt from Mode2 */
  const optimizePrompt = useCallback(
    async (rough) => {
      setOpen(true);
      setMessages((prev) => [
        ...prev,
        {
          id: uid("u"),
          role: "user",
          text: `帮我优化咒语：${rough || "（空）"}`,
          createdAt: Date.now(),
        },
      ]);
      setStatus("thinking");
      const prompt = await expandPromptSmart(rough || "cute penguin dreamy transform");
      appendAssistantTyped(`优化完成！已一键填入输入框：\n\n「${prompt}」`, { promptFill: prompt });
      applyPromptFill(prompt);
      return prompt;
    },
    [appendAssistantTyped, applyPromptFill, expandPromptSmart],
  );

  const triggerSocialAgents = useCallback((post) => buildSocialAgentReactions(post || {}), []);

  const value = useMemo(
    () => ({
      meta: AGENT_META,
      open,
      setOpen,
      status,
      hint,
      messages,
      badges,
      quickActions: QUICK_ACTIONS,
      deepseekOn,
      sendUserMessage,
      runQuickAction,
      askAgentOpinion,
      optimizePrompt,
      registerPromptSetter,
      pushBadge,
      triggerSocialAgents,
    }),
    [
      open,
      status,
      hint,
      messages,
      badges,
      deepseekOn,
      sendUserMessage,
      runQuickAction,
      askAgentOpinion,
      optimizePrompt,
      registerPromptSetter,
      pushBadge,
      triggerSocialAgents,
    ],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function usePenguinAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("usePenguinAgent must be used within AgentProvider");
  return ctx;
}
