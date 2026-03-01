# What’s going on — main files explained (plain English)

## That `<nextjs-portal>` thing you saw

You might see something like `<nextjs-portal ...>` in the browser’s inspector (or in the page source). **You didn’t add that.** Next.js adds it automatically when you run `npm run dev` or `yarn dev`. It’s used for:

- The dev overlay (errors, warnings)
- Fast Refresh
- Other dev tools

You can ignore it. It’s not part of your code.

---

## How the app decides what to show (the flow)

1. You open a **URL** in the browser (e.g. `http://localhost:3000/playground`).
2. Next.js looks at the **path** (`/`, `/playground`, `/learn-react`, etc.).
3. It finds the matching **file** in the `app/` folder and renders that **page**.
4. Every page is wrapped by **layout** files (shared shell).

So: **URL path = folder under `app/`**. The **page** file is what actually draws that screen.

---

## The main files and what they do

### 1. `app/layout.tsx` — The wrapper around every page

- **What it is:** The outer shell for the whole app (the `<html>` and `<body>`).
- **What it does:** Loads fonts, global CSS, and things that wrap every screen (e.g. tooltips). It has a `{children}` slot where the current page gets inserted.
- **When to touch it:** When you want to change fonts, add a global header/footer, or change the default look for the whole site.
- **Analogy:** The frame of the house. Every “room” (page) sits inside this frame.

---

### 2. `app/page.tsx` — The home page (`/`)

- **What it is:** The page that runs when someone goes to `http://localhost:3000/` (the root URL).
- **What it does:** Right now it only does `redirect("/playground")`, so visiting `/` immediately sends you to `/playground`.
- **When to touch it:** When you want the home page to show real content instead of redirecting.
- **Analogy:** The front door. Right now it just sends you to another room.

---

### 3. `app/playground/layout.tsx` — The sidebar + main area (only for `/playground`)

- **What it is:** A layout that wraps **only** routes under `/playground` (e.g. `/playground` itself).
- **What it does:** Renders the **sidebar** (nav links, session list, etc.) and puts the current page content in the main area next to it.
- **When to touch it:** When you want to change sidebar links, add new nav items, or change how the playground “frame” looks.
- **Analogy:** The layout of the “playground” section: sidebar on the side, content in the middle.

---

### 4. `app/playground/page.tsx` — The main playground screen

- **What it is:** The actual **page** that shows when you’re at `http://localhost:3000/playground`.
- **What it does:**
  - If you’re **not** connected to a database: shows the **connection card** (form to enter the Postgres connection string).
  - If you **are** connected: shows the **status bar** (green “Connected” strip) and the **Chat** component below.
- **When to touch it:** When you want to change the connect form, the “Connected” bar, or how the playground page is structured.
- **Analogy:** The main room of the playground: either “enter your connection” or “chat with the database.”

---

### 5. `app/learn-react/page.tsx` — Your practice page

- **What it is:** A page at `http://localhost:3000/learn-react` with simple React examples (counter, input, list).
- **What it does:** Gives you a safe place to try React and build UI without touching the main app.
- **When to touch it:** Whenever you’re learning or experimenting. This is the best place to start.
- **Analogy:** Your practice room. Mess around here first.

---

### 6. `components/chat.tsx` — The chat UI

- **What it is:** The chat interface: message list, input box, send button, and logic for talking to the LLM/database.
- **What it does:** Fetches schema, shows user and assistant messages, sends your messages to the API, and streams back the reply. It’s **used by** `app/playground/page.tsx` when you’re connected.
- **When to touch it:** When you want to change how messages look, how the input works, or how sending/streaming behaves.
- **Analogy:** The chat “widget” that the playground page drops in once you’re connected.

---

### 7. `app/globals.css` — Global styles

- **What it is:** One big CSS file that applies to the whole app.
- **What it does:** Imports Tailwind and theme variables (colors, etc.). Affects every page.
- **When to touch it:** When you want to change default colors, fonts, or global spacing.
- **Analogy:** The paint and style rules for the whole house.

---

## Quick reference: “I want to change…”

| I want to…                          | Edit this file                     |
|-------------------------------------|------------------------------------|
| What the home page does             | `app/page.tsx`                     |
| Fonts / global look                 | `app/layout.tsx` or `app/globals.css` |
| Sidebar links / playground frame    | `app/playground/layout.tsx`        |
| Connect form or “Connected” bar     | `app/playground/page.tsx`           |
| Chat messages, input, send button  | `components/chat.tsx`              |
| Practice React / try things         | `app/learn-react/page.tsx`         |

---

## Summary

- **`<nextjs-portal>`** = added by Next.js for dev tools; ignore it.
- **URL** → **folder under `app/`** → **`page.tsx`** = what you see.
- **Layouts** wrap pages (root layout = whole app; playground layout = sidebar + content).
- **`chat.tsx`** is the chat UI used on the playground page when connected.
- For learning and experimenting, live in **`app/learn-react/page.tsx`** and leave the rest for later.
