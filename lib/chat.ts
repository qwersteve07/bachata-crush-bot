import type { BetaMessageStreamParams } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { FLOW_EVENT_URL, loadFlowEventContent, loadSiteContent } from "@/lib/site";
import { INSTAGRAM_URL, loadInstagramContent } from "@/lib/instagram";

// Switch models without a code change by setting CHAT_MODEL in Vercel.
export const DEFAULT_MODEL = "claude-sonnet-5-5";

// FAQ answers are short; this also caps what one off-topic request can cost.
const MAX_TOKENS = 1500;

const INSTRUCTIONS = `You are the Q&A assistant for Bachata Crush, a bachata dance festival held at Flow Taipei in Taiwan.
Answer visitors' questions using ONLY the reference content provided below:
- <website>: the official festival site, bachatacrush.com.
- <ticket_page>: the festival's ticket page on flowtaipei.com (dates, venue, pass prices and early-bird deadlines, how to buy, refund/transfer policy). Link to it for anything about buying tickets.
- <instagram>: recent posts from the festival's Instagram; posts marked （釘選） are pinned. Each post is headed by its date. When it conflicts with older info elsewhere, prefer the newer post and mention its date.

- Only help with questions about Bachata Crush, the venue, and attending the festival. Politely decline anything else (writing, coding, homework, general chat) in one sentence.
- If the answer isn't in the reference content, say you don't know and suggest checking https://bachatacrush.com or the Bachata Crush Instagram. Never invent dates, prices, names, or policies.
- Reply in the same language the visitor writes in (e.g. Traditional Chinese for 中文 questions, English for English).
- Keep answers short and friendly. Use markdown links to the relevant page on the site when it helps.`;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function parseMessages(body: unknown): ChatMessage[] | null {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const messages = raw.slice(-12).filter(
    (m): m is ChatMessage =>
      (m?.role === "user" || m?.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0 &&
      m.content.length <= 2000,
  );
  // The conversation must start and end with a user turn.
  while (messages[0]?.role === "assistant") messages.shift();
  return messages.at(-1)?.role === "user" ? messages : null;
}

// Throws only if the main site can't be loaded; the other sources are bonuses.
export async function loadReference(): Promise<string> {
  const [site, flow, ig] = await Promise.allSettled([
    loadSiteContent(),
    loadFlowEventContent(),
    loadInstagramContent(),
  ]);
  if (site.status === "rejected") throw site.reason;
  if (flow.status === "rejected") console.error(flow.reason);
  if (ig.status === "rejected") console.error(ig.reason);
  return (
    `<website url="https://bachatacrush.com">\n${site.value}\n</website>` +
    (flow.status === "fulfilled"
      ? `\n\n<ticket_page url="${FLOW_EVENT_URL}">\n${flow.value}\n</ticket_page>`
      : "") +
    (ig.status === "fulfilled" && ig.value
      ? `\n\n<instagram url="${INSTAGRAM_URL}">\n${ig.value}\n</instagram>`
      : "")
  );
}

export function chatParams(
  model: string,
  reference: string,
  messages: ChatMessage[],
): BetaMessageStreamParams {
  return {
    model,
    max_tokens: MAX_TOKENS,
    output_config: { effort: "low" },
    // Haiku has no server-side refusal fallback; Opus and Sonnet do.
    ...(model.startsWith("claude-haiku")
      ? {}
      : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
    system: [
      { type: "text", text: INSTRUCTIONS },
      {
        type: "text",
        text: reference,
        // Low traffic: a 1-hour cache keeps most questions on cheap cache reads.
        cache_control: { type: "ephemeral", ttl: "1h" },
      },
    ],
    messages,
  };
}
