import { readFile } from "node:fs/promises";
import path from "node:path";

export const INSTAGRAM_URL = "https://www.instagram.com/bachata_crush_tw/";

// Instagram posts are maintained by hand in data/instagram.md (Instagram has no
// public API for accounts we don't manage). HTML comments hold editing notes.
export async function loadInstagramContent(): Promise<string> {
  const md = await readFile(path.join(process.cwd(), "data", "instagram.md"), "utf8");
  return md.replace(/<!--[\s\S]*?-->/g, "").trim();
}
