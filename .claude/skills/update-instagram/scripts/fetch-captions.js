// Run on instagram.com (logged in) after list-posts.js.
// Fetches each post's HTML one at a time and parses og:description:
//   "<likes>, <comments> - <author> on <Month D, YYYY>: "<caption>"."
// Results accumulate in window.__ig. With many posts this outlives the tool's
// 45 s timeout; keep polling window.__ig.length until it stops growing.
window.__ig = [];
for (const l of window.__links) {
  const r = await fetch(l.href, { credentials: "include" });
  const d = new DOMParser().parseFromString(await r.text(), "text/html");
  const og = d.querySelector('meta[property="og:description"]')?.content || "";
  const m = og.match(/^(.*?) - (\S+) on ([A-Z][a-z]+ \d{1,2}, \d{4}): "([\s\S]*)"\.?\s*$/);
  window.__ig.push({
    ...l,
    status: r.status,
    author: m?.[2],
    date: m?.[3],
    caption: m ? m[4] : og,
    img: d.querySelector('meta[property="og:image"]')?.content,
  });
  if (r.status !== 200) break; // rate-limited or logged out: stop and report
  await new Promise((res) => setTimeout(res, 1500));
}
window.__ig
  .map((p) => `${p.pinned ? "[PIN] " : ""}${p.date} @${p.author} ${p.href}${p.carousel ? " (carousel)" : ""} :: ${p.caption.slice(0, 60).replace(/\n/g, " ")}`)
  .join("\n");
