// Run on https://www.instagram.com/bachata_crush_tw/ via mcp__Claude_Browser__javascript_tool.
// Scrolls the profile grid so more posts load, then lists every post link.
// Result is also kept in window.__links for fetch-captions.js.
const SCROLLS = 2; // raise to load older posts (~12 posts per scroll)

for (let i = 1; i <= SCROLLS; i++) {
  window.scrollTo(0, i * 1200);
  await new Promise((r) => setTimeout(r, 2500));
}

window.__links = [...document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')].map((a) => ({
  href: a.getAttribute("href"),
  pinned: !!a.querySelector('svg[aria-label*="inned"]'),
  carousel: !!a.querySelector('svg[aria-label="Carousel"]'),
}));
window.__links;
