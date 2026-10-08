// Run on instagram.com (logged in). Set URL to a post path, e.g. "/bachata_crush_tw/p/Dds73oNI68_/".
// Opens the post in-app, clicks through every slide, and returns the largest
// (1080px) image URL of each one. Works for single-image posts too.
const URL = "/bachata_crush_tw/p/XXXXXXXXXXX/";

history.pushState({}, "", URL);
window.dispatchEvent(new PopStateEvent("popstate"));
await new Promise((r) => setTimeout(r, 3500));

const best = (img) =>
  img.srcset
    ? img.srcset
        .split(",")
        .map((s) => s.trim().split(" "))
        .sort((a, b) => parseInt(b[1]) - parseInt(a[1]))[0][0]
    : img.src;

const seen = new Map();
for (let k = 0; k < 20; k++) {
  document.querySelectorAll("main ul li img, main article img").forEach((img) => {
    const src = best(img);
    const key = src.split("?")[0];
    if (img.naturalWidth >= 300 && !seen.has(key)) seen.set(key, src);
  });
  const next = document.querySelector('main button[aria-label="Next"]');
  if (!next) break;
  next.click();
  await new Promise((r) => setTimeout(r, 900));
}
[...seen.values()].join("\n");
