// Pulls every page of bachatacrush.com through its WordPress REST API and
// flattens it to plain text so it can be handed to Claude as reference material.

const SITE = "https://bachatacrush.com";
const REVALIDATE_SECONDS = 60 * 60; // refresh site content at most once an hour

type WpPage = {
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'");
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      // Keep links as markdown so Claude can point people to them.
      .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
        const label = text.replace(/<[^>]+>/g, "").trim();
        return label ? `[${label}](${href})` : href;
      })
      // Images carry information (e.g. artist names live only in file names).
      .replace(/<img\s[^>]*src="([^"]+)"[^>]*>/gi, (tag, src) => {
        const alt = /alt="([^"]*)"/i.exec(tag)?.[1]?.trim();
        const file = src.split("/").pop()!.replace(/\.\w+$/, "").replace(/[-_]small$/, "");
        return `\n[Image: ${alt || file.replace(/[_-]+/g, " ")}](${src})\n`;
      })
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h[1-6]|li|div|tr)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export async function loadSiteContent(): Promise<string> {
  const res = await fetch(
    `${SITE}/wp-json/wp/v2/pages?per_page=100&_fields=slug,link,title,content`,
    { next: { revalidate: REVALIDATE_SECONDS } },
  );
  if (!res.ok) throw new Error(`Failed to load ${SITE}: HTTP ${res.status}`);
  const pages = (await res.json()) as WpPage[];

  // Home first, the rest alphabetically, so the text (and prompt cache) is stable.
  pages.sort((a, b) =>
    a.slug === "home" ? -1 : b.slug === "home" ? 1 : a.slug.localeCompare(b.slug),
  );

  return pages
    .map(
      (p) =>
        `<page title="${decodeEntities(p.title.rendered)}" url="${p.link}">\n${htmlToText(p.content.rendered)}\n</page>`,
    )
    .join("\n\n");
}
