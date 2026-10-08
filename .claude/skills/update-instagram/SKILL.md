---
name: update-instagram
description: Refresh data/instagram.md (the Q&A bot's Instagram reference) from @bachata_crush_tw — read recent and pinned posts in the built-in browser with the user's own Instagram login, read captions, view every poster/carousel image, and rewrite the file. Use when the user asks to update/sync/crawl/爬 the Bachata Crush Instagram, add new IG posts, or refresh the bot's IG data. Optional args: a start date (e.g. "9/20" or "2026-09-20"); default is the newest date already in data/instagram.md.
---

# Update the Instagram reference data

The chat bot reads `data/instagram.md` (via `lib/instagram.ts`) as its source for Instagram content. Instagram has no public API for this account and blocks logged-out requests, so the data is gathered by browsing the profile with the user's own login, then written by hand into that file.

## Ground rules

- **The user logs in themselves.** Open the login page in the built-in browser and wait. Never type Instagram credentials or 2FA codes.
- **Read only.** Don't like, comment, follow, save, or change anything on the account. Only open pages and read them.
- **Go gently.** Fetch posts one at a time with a pause in between (the scripts use 1.5 s). If a request returns 429 or `require_login`, stop and tell the user rather than retrying in a loop.
- **Only what's posted.** Transcribe schedules, names, prices, and rules exactly as they appear on the posters. Don't fill gaps with guesses: if a poster doesn't give a dress code or course level, say so ("貼文未列…") instead of inventing one. Long essay-style captions can be summarized in Chinese, but keep every concrete fact.
- **Ask before publishing.** Show the user what changed, and commit or push only after they say yes.

## Workflow

### 1. Decide the range

- Start date: the user's argument if given. Otherwise, use the newest `## YYYY-MM-DD` heading in `data/instagram.md`, so only newer posts are added.
- Pinned posts are always included, even if they're older than the start date.

### 2. Log in

```
mcp__Claude_Browser__preview_start  url=https://www.instagram.com/accounts/login/
```

Ask the user to log in in the browser pane and reply when they're done.

### 3. List posts

Navigate to `https://www.instagram.com/bachata_crush_tw/`, wait about 3 s, then run [scripts/list-posts.js](scripts/list-posts.js) with `mcp__Claude_Browser__javascript_tool`. It scrolls the grid and returns `{href, pinned, carousel}` for each post, and stores the list in `window.__links`.

- The grid also shows collab posts that live under other accounts, such as `/flow.taipei/p/...`. Include them.
- If the oldest post returned is still newer than the start date, scroll further: run the script again with a larger `SCROLLS` value.

### 4. Read dates and captions

Run [scripts/fetch-captions.js](scripts/fetch-captions.js). It fetches each post's HTML in turn and parses the `og:description` meta tag (format: `… - <author> on <Month D, YYYY>: "<caption>"`) into `window.__ig`.

- Running it on more than about 25 posts takes longer than the tool's 45 s timeout. That's fine: the script keeps running in the page. Poll `window.__ig.length` until it stops growing.
- Then dump the posts that are in range or pinned:
  `window.__ig.filter(p => p.pinned || new Date(p.date) >= new Date('<start>')).map(...)`

### 5. Read the images

Many posts carry their real information only in the image: schedules, rosters, rules, FAQ. Look at the image for every in-range post, not just the ones whose caption looks thin.

1. **Get the image URLs.**
   - For a carousel, or for any post where you want every image, run [scripts/carousel.js](scripts/carousel.js). Set `URL` to the post path first. It steps through the slides and returns the 1080px image URLs.
   - For a single-image post, the post's `img` field from step 4 (`og:image`) is enough.
2. **Download the images.** Write a `name<TAB>url` list into a fresh folder in the scratchpad, then run [scripts/download.sh](scripts/download.sh) with that list and the folder as arguments. The CDN URLs are signed and expire in a few days, so download them in the same session you collect them.
3. **View each image.** Open each file with the Read tool and transcribe what it says.
   - If a carousel is a translation of another post (for example, a Chinese version of an English one), check one slide to confirm, then note "內容同 X" instead of transcribing it twice.

### 6. Write `data/instagram.md`

Keep the HTML comment header at the top of the file and update its "最後整理" date. Then, for each post:

```
## YYYY-MM-DD 簡短標題
連結：https://www.instagram.com/<author>/p/<code>/

（海報內容）…transcribed facts…
```

- Pinned posts: `## YYYY-MM-DD（釘選）標題`.
- Put the newest posts first and the pinned posts last. The bot is told to prefer newer posts when they conflict with older ones.
- **Repeated promo posts:** the same flyer text is often re-posted with small roster changes. Keep only the newest full version, and list what changed in each earlier version (who was added or removed).
- **Note cancellations and changes explicitly**, for example an artist who can't attend, or a schedule change.
- Posts that are only photos or videos with no information can be skipped. Reels: use the caption only, since audio and video can't be read.

### 7. Check and hand off

```bash
node --experimental-strip-types --no-warnings -e "import('./lib/instagram.ts').then(m=>m.loadInstagramContent()).then(t=>console.log(t.length))"
npm run build
```

Then give the user a short summary: how many posts and images you read, which new facts were added, and anything uncertain. Remind them their Instagram is still logged in in the browser pane, and ask whether to commit and push (Vercel redeploys from `main`).
