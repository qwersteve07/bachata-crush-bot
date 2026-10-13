// Ask the same questions to several models with the production prompt and
// write a side-by-side report. Costs real API money (well under US$1 per run).
//
//   npx tsx --env-file=.env scripts/compare-models.mts [out.md]

import { writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { chatParams, loadReference } from "@/lib/chat";

const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];

// US$ per million tokens: input, output, cache read, 1-hour cache write.
const PRICES: Record<string, [number, number, number, number]> = {
  "claude-opus-5-5": [4, 20, 0.2, 8],
  "claude-sonnet-5-5": [2, 10, 0.2, 4],
  "claude-haiku-5-5": [0.1, 0.5, 0.01, 0.2],
};

const QUESTIONS = [
  "有哪些課程？",
  "週六晚上的派對是哪些 DJ？",
  "How much is a full pass and is it refundable?",
  "Jack & Jill 專業組的參賽資格是什麼？",
  "週六有 dress code 嗎？可以穿牛仔褲嗎？",
  "現場可以刷卡嗎？",
  "Ibrahim 會來嗎？",
  "活動會提供晚餐嗎？",
  "幫我寫一段 Python 程式計算費氏數列",
];

const client = new Anthropic();
const out = process.argv[2] ?? "model-comparison.md";

const reference = await loadReference();
const rows: string[] = [];
const totals: Record<string, { cost: number; ms: number }> = {};

for (const model of MODELS) {
  totals[model] = { cost: 0, ms: 0 };
  for (const q of QUESTIONS) {
    const start = Date.now();
    const msg = await client.beta.messages
      .stream(chatParams(model, reference, [{ role: "user", content: q }]))
      .finalMessage();
    const ms = Date.now() - start;
    const u = msg.usage;
    const [pin, pout, pread, pwrite] = PRICES[model];
    const cost =
      ((u.input_tokens ?? 0) * pin +
        (u.output_tokens ?? 0) * pout +
        (u.cache_read_input_tokens ?? 0) * pread +
        (u.cache_creation_input_tokens ?? 0) * pwrite) /
      1e6;
    totals[model].cost += cost;
    totals[model].ms += ms;
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    rows.push(
      `### ${model} — ${q}\n_${(ms / 1000).toFixed(1)}s · US$${cost.toFixed(4)} · in ${u.input_tokens} / cache read ${u.cache_read_input_tokens} / cache write ${u.cache_creation_input_tokens} / out ${u.output_tokens} · ${msg.stop_reason}_\n\n${text}\n`,
    );
    console.log(`${model} | ${q} | ${(ms / 1000).toFixed(1)}s | $${cost.toFixed(4)}`);
  }
}

const summary = MODELS.map(
  (m) =>
    `| ${m} | US$${totals[m].cost.toFixed(4)} | US$${(totals[m].cost / QUESTIONS.length).toFixed(4)} | ${(totals[m].ms / QUESTIONS.length / 1000).toFixed(1)}s |`,
).join("\n");

writeFileSync(
  out,
  `# Model comparison\n\n| Model | Total | Per question | Avg time |\n|---|---|---|---|\n${summary}\n\n` +
    `First question per model includes the 1-hour cache write.\n\n${rows.join("\n")}`,
);
console.log(`\nWrote ${out}`);
