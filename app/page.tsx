"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "2026 年的活動時間表是什麼？",
  "要去哪裡買票？",
  "Jack & Jill 比賽怎麼報名？",
  "場地附近有推薦的住宿嗎？",
];

// Minimal markdown: [links](url), bare URLs, **bold**, and line breaks.
function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const href = m[2] ?? m[3];
    if (href) {
      parts.push(
        <a key={m.index} href={href} target="_blank" rel="noopener noreferrer">
          {m[1] ?? href}
        </a>,
      );
    } else {
      parts.push(<strong key={m.index}>{m[4]}</strong>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function Markdown({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i}>{line.trim() ? renderInline(line.replace(/^#+\s*/, "")) : " "}</p>
      ))}
    </>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    const history: Message[] = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: answer }]);
      }
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "發生錯誤，請稍後再試。";
      setMessages([...history, { role: "assistant", content: msg }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="wrap">
      <header>
        <h1>Bachata Crush 問答</h1>
        <p className="sub">
          關於 <a href="https://bachatacrush.com" target="_blank" rel="noopener noreferrer">bachatacrush.com</a>{" "}
          的任何問題都可以問我 · Ask me anything about the festival
        </p>
      </header>

      <section className="chat">
        {messages.length === 0 && (
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.content ? <Markdown text={m.content} /> : <span className="typing">思考中…</span>}
          </div>
        ))}
        <div ref={endRef} />
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="輸入你的問題…"
          maxLength={2000}
          autoFocus
        />
        <button type="submit" disabled={loading || !input.trim()}>
          送出
        </button>
      </form>
    </main>
  );
}
