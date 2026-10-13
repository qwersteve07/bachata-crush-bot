import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL, chatParams, loadReference, parseMessages } from "@/lib/chat";
import { checkRateLimit, clientId } from "@/lib/ratelimit";

export const maxDuration = 60;

const client = new Anthropic();
const MODEL = process.env.CHAT_MODEL || DEFAULT_MODEL;

export async function POST(req: Request) {
  const retryAfter = await checkRateLimit(clientId(req));
  if (retryAfter !== null) {
    const minutes = Math.ceil(retryAfter / 60);
    return new Response(
      `問題有點多了，請 ${minutes} 分鐘後再試。You've asked a lot of questions — please try again in ${minutes} min.`,
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const messages = parseMessages(await req.json().catch(() => null));
  if (!messages) return new Response("Invalid request", { status: 400 });

  let reference: string;
  try {
    reference = await loadReference();
  } catch (err) {
    console.error(err);
    return new Response("無法讀取 bachatacrush.com，請稍後再試。", { status: 502 });
  }

  const stream = client.beta.messages.stream(chatParams(MODEL, reference, messages));

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
        const { input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens } =
          final.usage;
        console.log(
          JSON.stringify({
            event: "chat_usage",
            model: final.model,
            stop_reason: final.stop_reason,
            input_tokens,
            cache_read_input_tokens,
            cache_creation_input_tokens,
            output_tokens,
          }),
        );
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n抱歉，這個問題我無法回答。"));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n（回答太長被截斷了，可以問得更具體一點。）"));
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
