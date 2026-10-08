import Anthropic from "@anthropic-ai/sdk";
import { loadSiteContent } from "@/lib/site";

export const maxDuration = 60;

const client = new Anthropic();

const INSTRUCTIONS = `You are the Q&A assistant for Bachata Crush, a bachata dance festival held at Flow Taipei in Taiwan.
Answer visitors' questions using ONLY the website content provided in <website> below.

- If the answer isn't in the website content, say you don't know and suggest checking https://bachatacrush.com or the Bachata Crush Instagram. Never invent dates, prices, names, or policies.
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

  let site: string;
  try {
    site = await loadSiteContent();
  } catch (err) {
    console.error(err);
    return new Response("無法讀取 bachatacrush.com，請稍後再試。", { status: 502 });
  }

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
        text: `<website url="https://bachatacrush.com">\n${site}\n</website>`,
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
