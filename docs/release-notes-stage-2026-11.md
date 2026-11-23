# XSC Knowledge Hub — Release Notes (Stage)

**Branch:** `stage`, 42 commits ahead of `main` (Nov 13 – Nov 19, 2026)

| Environment | URL | Access |
|---|---|---|
| **Stage** (these release notes) | `https://stage.xscknowledgehub.adobe.com` | Okta sign-in via the AEM Edge Function |
| **Current production** | `https://main--contentxscknowledgehub--adobedevxsc.aem.live` | Served directly from the EDS origin; gated by Sidekick authoring login |

---

## Highlights

- **Okta sign-in.** Content is restricted to members of the `GRP-XSCKNOWLEDGEHUB` group, with a public landing page for visitors who aren't signed in.
- **Personal profile menu.** Includes your own avatar, favorites, custom links and quick links.
- **Favorite any page** with one click.
- **Author avatars** on pages that have a single author.
- **Adobe Analytics** tagging across the site.

---

## Sign-in and access

- Content is protected by Okta through an AEM Edge Function. Only members of **GRP-XSCKNOWLEDGEHUB** can view it; any Adobe employee can subscribe to the group in the IAM Portal.
- **All Solution Consultants are pre-enrolled** (`ORG-JFIGUEIR-ALL`) through the IAM Portal, so they need no action.
- Bulk enrollment was done with an AD query (for example, `Who "ORG-JFIGUEIR-ALL"`), whose output GitHub Copilot turned into a comma-delimited list for the IAM Portal.
- Visitors who aren't signed in land on a branded public **/home** page with **Sign in** and **Sign up** buttons.
- **Sign up** opens a modal that explains how to request access through the Adobe IAM Portal. Authors can edit its text in the second section of the /home document.
- The header shows **Sign in**, or the signed-in user's avatar and name.
- Behind the scenes:
  - Settings and secrets are loaded from Cloud Manager.
  - Okta redirects use the site's public address.
  - Sign-in is more robust, with better diagnostics.

## Profile menu (header)

Click your name in the header to open a compact menu:

| Section | What it does |
|---|---|
| **Profile** | Shows your name and email. **+ Avatar** uploads a profile picture; once you have one, **Change** and **Delete** replace it. |
| **Quick links** | **SharePoint Home** (the Knowledge Hub folder). Opens in a new tab. |
| **Favorites** | The 5 pages you favorited most recently, with **View all** if there are more and **×** to remove one. |
| **My links** | Your own bookmarks. **+ Add** saves a title and URL; **×** removes a link. |
| **Sign out** | Ends your session. |

## Custom avatars

- Upload a **JPG, PNG, WebP or GIF** image (up to 10 MB) in the upload window. You can choose a file or drag it in, and you see a preview.
- Images are cropped to a square and shrunk to 256×256. Animated GIFs keep only their first frame.
- Your avatar replaces your initials in the header and in the menu.
- **Pages with a single author** show that author's avatar next to their name on the page, visible to every signed-in reader.
  - Matching uses the author's Okta display name, which must match the page's `Author` metadata.
  - Pages with several authors keep the generic author icon.
  - Before your avatar appears on pages, you need to upload it, or sign in and open any page after uploading.

## Page favorites

- A **☆** next to the page title saves the page to your favorites. A gold **★** means it is already saved.
- It doesn't appear on home, search, contact, `/tools/` or draft pages. Authors can turn it off on any page with page metadata `Favorite: off`.
- You can save up to 200 favorites, and they follow you across browsers and devices.

## My links

- Save up to 50 personal links. A missing `https://` is added for you, and only web links are accepted.
- If you leave the title blank, the site name is used.
- **View Analytics** (the Adobe Analytics workspace) is added once to the My links of selected users on their next sign-in. They can remove it, and it will not come back.

## Analytics

- Adobe Experience Platform Web SDK (alloy 2.37.1) is set up, with Analytics enabled on the production host.
- **Block-level tracking:**
  - Block impressions are counted after a block has been visible for 1 second.
  - Clicks inside blocks are tracked, along with the order of blocks a reader moves through.
  - These use event10–11, eVar10–13 and prop10–12. eVar13 is the site section and prop12 is the block path.
- Data is collected by default, because the site has no consent banner.
- The Adobe Analytics build guide was added to the docs and updated.

## Forms and content

- **Contact us** (Microsoft Forms) links now open in a modal on the same page instead of leaving the site.
- Setup guides were added to the docs.

## Platform (behind the scenes)

- A new **per-user data service** (App Builder `per-user-metadata`) stores avatars, favorites and links for each user.
  - The site reaches it through `/api/kv/*`, which only works for signed-in users.
  - Each request is signed by the Edge Function, so it can't be tampered with.
  - Data is kept for 365 days and the clock restarts whenever it is used.
- The Edge Function now passes along the signed-in user's display name so author avatars can be looked up.

---

## Known issues and open items

- **Stage analytics go to the production report suite.** This was intentional for testing; switch stage to its own report suite before go-live.
- **Sign up modal text** on /home still needs to be authored.
- **Search tracking** (event12/eVar15) is proposed but not built yet.
- **Author avatars** only appear when the page's `Author` metadata matches the author's Okta display name exactly; letter case and extra spaces don't matter.
- The profile features use the stage sign-in service, so they appear only on stage. Current production (`main--…aem.live`) has no Okta session or `/api/kv`, so readers there won't see them until production moves behind the Edge Function.

## Go Live Roadmap

1. Stage QA through to winter shutdown
2. Go live Jan 4
   1. Push the `stage` branch to `main`
   2. Configure the Web SDK datastream to prod
