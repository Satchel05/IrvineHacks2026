# Start here — Build a simple website (never used React)

## 1. Which file to start with

**Only this one:** `app/learn-react/page.tsx`

- It’s your practice page. Everything you do at first can live here.
- Run `npm run dev`, open **http://localhost:3000/learn-react**, edit the file, save → page updates.
- Build your simple website inside this one file until you’re comfortable.

---

## 2. What to ignore (for now)

Don’t open or worry about these until later:

| Ignore | Why |
|--------|-----|
| `app/api/*` | Backend/API routes — not needed for a simple static or client-only site |
| `app/store/*` | State management — you’ll use `useState` first |
| `app/playground/*` | Existing app logic — focus on your own page |
| `hooks/`, `lib/` | Helpers — use them only when something tells you to |
| `next.config.ts`, `tsconfig.json`, `postcss.config.mjs` | Config — leave as-is |
| Most of `components/` | Use only `components/ui/` (Button, Card, Input) when you need them |

**Only touch:** `app/learn-react/page.tsx` and maybe `app/globals.css` if you want to change colors/fonts.

---

## 3. Fundamentals (in order)

Learn in this order. Each one is in `app/learn-react/page.tsx` already.

### 1) JSX — the “HTML” in React

- Looks like HTML but it’s inside JavaScript: `<div>`, `<p>`, `<button>`.
- Use `{variable}` to show a variable: `<p>Count: {count}</p>`.
- One top-level element per return (wrap multiple things in a `<div>` or `<>...</>`).

### 2) Components — functions that return JSX

- A component is a function that returns that HTML-like JSX.
- Example: `function Counter() { return <div>...</div>; }`
- You “use” it like a tag: `<Counter />`.

### 3) State — data that can change

- `const [value, setValue] = useState(initialValue);`
- When you call `setValue(newValue)`, React re-renders and the screen updates.
- See the **Counter** and **Mirror input** examples in `learn-react/page.tsx`.

### 4) Events — when the user does something

- `onClick={() => doSomething()}` — button click.
- `onChange={(e) => setText(e.target.value)}` — user types in an input.
- You usually call your state setter inside these.

### 5) Lists — rendering many items

- Store an array in state: `const [items, setItems] = useState([...]);`
- Render with `.map()`: `{items.map((item, i) => <li key={i}>{item}</li>)}`
- See the **Todo list** example.

### 6) Styling — making it look good

- Use the `className` prop with **Tailwind** classes: `className="p-4 rounded-lg bg-blue-500 text-white"`.
- Common: `flex`, `gap-4`, `p-4`, `rounded-xl`, `bg-...`, `text-...`, `border`.

---

## 4. Order of learning (what to do)

1. **Run the app:** `npm run dev` → open http://localhost:3000/learn-react
2. **Change small things** in `app/learn-react/page.tsx`: numbers, text, button labels
3. **Add one new section** (e.g. a new card with a heading and a paragraph)
4. **Add state:** a button that changes a number or some text (copy the Counter pattern)
5. **Add an input** that shows what you type (copy the Mirror input pattern)
6. **Style it** with Tailwind in `className` (padding, colors, flexbox)

Once that feels okay, add a new page: create `app/my-site/page.tsx` and build your simple website there. Use the same patterns (components, useState, events, Tailwind).
