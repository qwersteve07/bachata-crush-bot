import Anthropic from "@anthropic-ai/sdk";
import { FLOW_EVENT_URL, loadFlowEventContent, loadSiteContent } from "@/lib/site";
import { INSTAGRAM_URL, loadInstagramContent } from "@/lib/instagram";

export const maxDuration = 60;

const client = new Anthropic();

const INSTRUCTIONS = `You are the Q&A assistant for Bachata Crush, a bachata dance festival held at Flow Taipei in Taiwan.
Answer visitors' questions using ONLY the reference content provided below:
- <website>: the official festival site, bachatacrush.com.
- <ticket_page>: the festival's ticket page on flowtaipei.com (dates, venue, pass prices and early-bird deadlines, how to buy, refund/transfer policy). Link to it for anything about buying tickets.
- <instagram>: recent posts from the festival's Instagram; posts marked （釘選） are pinned. Each post is headed by its date. When it conflicts with older info elsewhere, prefer the newer post and mention its date.

- If the answer isn't in the reference content, say you don't know and suggest checking https://bachatacrush.com or the Bachata Crush Instagram. Never invent dates, prices, names, or policies.
- Reply in the same language the visitor writes in (e.g. Traditional Chinese for 中文 questions, English for English).
- Keep answers short and friendly. Use markdown links to the relevant page on the site when it helps.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

function parseMessages(body: unknown): ChatMessage[] | null {
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

export async function POST(req: Request) {
  const messages = parseMessages(await req.json().catch(() => null));
  if (!messages) return new Response("Invalid request", { status: 400 });

  const [site, flow, ig] = await Promise.allSettled([
    loadSiteContent(),
    loadFlowEventContent(),
    loadInstagramContent(),
  ]);
  if (site.status === "rejected") {
    console.error(site.reason);
    return new Response("無法讀取 bachatacrush.com，請稍後再試。", { status: 502 });
  }
  // The ticket page is a bonus; answer from the main site alone if it's down.
  if (flow.status === "rejected") console.error(flow.reason);
  if (ig.status === "rejected") console.error(ig.reason);
  const reference =
    `<website url="https://bachatacrush.com">\n${site.value}\n</website>` +
    (flow.status === "fulfilled"
      ? `\n\n<ticket_page url="${FLOW_EVENT_URL}">\n${flow.value}\n</ticket_page>`
      : "") +
    (ig.status === "fulfilled" && ig.value
      ? `\n\n<instagram url="${INSTAGRAM_URL}">\n${ig.value}\n</instagram>`
      : "");

  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: INSTRUCTIONS },
      {
        type: "text",
        text: reference,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n抱歉，這個問題我無法回答。"));
        }
      } catch (err) {
        console.error(err);
        controller.enqueue(encoder.encode("\n\n（發生錯誤，請稍後再試。）"));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
