# React mini crash course (with analogies)

A short guide so you can build things on your own. Uses the same "building" idea: your app is a building, pages are rooms, components are furniture.

---

## 1. Components = reusable pieces of the room

**Idea:** A component is a function that returns what you see (the "HTML-like" stuff). You use it like a custom tag: `<Button />`, `<Card />`.

**Analogy:** A component is like a **piece of furniture with a recipe**. You don’t build a new chair from scratch every time; you have one "Chair" recipe. You can put many chairs in a room, or the same Card in different places. Each time you write `<Card>...</Card>`, you’re "placing" that piece.

**In code:**
```jsx
function Greeting() {
  return <p>Hello!</p>;
}

// Using it:
<Greeting />
```

You’ll mostly **use** components (from `@/components/ui` or that you write) and **compose** them in a page.

---

## 2. JSX = the "HTML" inside JavaScript

**Idea:** What you write in React looks like HTML but lives in JavaScript. Tags like `<div>`, `<p>`, `<button>`. That’s called **JSX**.

**Analogy:** JSX is the **blueprint language** for each piece. You’re not writing a raw HTML file; you’re describing the structure in the same file as your logic. One language for both "what it looks like" and "how it behaves."

**Rules:**
- **One top-level wrapper** per return. Multiple siblings? Wrap in a `<div>` or `<>...</>` (fragment).
- **Show a variable** with curly braces: `<p>Count: {count}</p>`.
- **Class names** go in `className`, not `class`: `<div className="p-4 rounded">`.

```jsx
return (
  <div>
    <h1>Title</h1>
    <p>You have {count} items.</p>
  </div>
);
```

---

## 3. Props = instructions you pass into a component

**Idea:** Props are inputs you give to a component so it can look or behave differently each time you use it.

**Analogy:** Like **options on a piece of furniture**. Same "Button" component, but one time you pass `label="Save"` and another time `label="Cancel"`. The recipe (component) is the same; the instructions (props) change what appears.

**In code:**
```jsx
function Button({ label, onClick }) {
  return <button onClick={onClick}>{label}</button>;
}

// Using it with different "instructions":
<Button label="Save" onClick={handleSave} />
<Button label="Cancel" onClick={handleCancel} />
```

You **define** props in the component’s function parameters; you **pass** them when you use the component.

---

## 4. State = memory that can change (and redraw the room)

**Idea:** State is data that can change over time. When it changes, React redraws the part of the UI that depends on it.

**Analogy:** State is like a **whiteboard in the room**. When you update the whiteboard (change state), React redraws the room so what’s on the screen matches the whiteboard. So: "what’s on the whiteboard" = state; "what the user sees" = the UI driven by that state.

**In code:**
```jsx
const [count, setCount] = useState(0);
//  count  = current value (read it to show it)
//  setCount = function to update it (call it to change the whiteboard)

return (
  <div>
    <p>Count: {count}</p>
    <button onClick={() => setCount(count + 1)}>Add one</button>
  </div>
);
```

- **Read** state to **show** it: `{count}`.
- **Update** state to **change** the UI: `setCount(newValue)`. Don’t change the variable directly; always use the setter.

---

## 5. Events = when the user does something, run code

**Idea:** You attach functions to user actions: clicks, typing, submitting. Those functions often update state or call other logic.

**Analogy:** **Events are the buttons and knobs** on the furniture. When the user clicks or types, the "wire" you connected (the function) runs. Usually that means updating the whiteboard (state) or doing something else (e.g. send a message).

**Common ones:**
- **`onClick`** — user clicked.
- **`onChange`** — user changed an input (e.g. typing). You often do `setSomething(e.target.value)`.
- **`onSubmit`** — form submitted. Use `e.preventDefault()` so the page doesn’t reload.

```jsx
<button onClick={() => setCount(count + 1)}>Add</button>

<input
  value={text}
  onChange={(e) => setText(e.target.value)}
/>
```

---

## 6. Lists = show many items from one array

**Idea:** You keep an array in state (or from props). You loop over it and render one component per item.

**Analogy:** Like **a list of names on the whiteboard**. You have one list (array); you draw one "row" or "card" per item. The whiteboard (state) holds the list; the JSX just says "for each item, draw this."

**In code:**
```jsx
const [items, setItems] = useState(["Apple", "Banana", "Cherry"]);

return (
  <ul>
    {items.map((item, index) => (
      <li key={index}>{item}</li>
    ))}
  </ul>
);
```

**`key`:** React wants a unique `key` per item (often `key={item.id}` or `key={index}`). It uses it to know which row is which when the list changes.

---

## 7. Styling = Tailwind classes in `className`

**Idea:** You don’t write separate CSS files for every little thing. You use **Tailwind** classes in the `className` prop.

**Analogy:** Like **labels on the blueprint**: "this div is padded, rounded, and blue." The class names are the labels; Tailwind turns them into real styles.

**Handy classes:**
- Spacing: `p-4` (padding), `m-2` (margin), `gap-4` (space between flex/grid children).
- Layout: `flex`, `flex-col`, `items-center`, `justify-between`.
- Look: `rounded-lg`, `bg-blue-500`, `text-white`, `border`, `shadow`.
- Sizing: `w-full`, `h-10`, `max-w-md`.

```jsx
<div className="flex flex-col gap-4 p-4 rounded-xl bg-muted">
  <h2 className="text-lg font-semibold">Title</h2>
  <p className="text-muted-foreground">Description.</p>
</div>
```

---

## 8. The mental loop (how it all works together)

1. **State** = the single source of truth (the whiteboard).
2. You **render** UI from state: show `{count}`, map over `items`, etc.
3. **Events** run when the user does something; inside them you **update state** (`setCount`, `setItems`, etc.).
4. When state changes, React **re-renders** the component so the screen matches the new state.

So: **state → what you draw → user does something → event handler updates state → React redraws.** That loop is the core of most small UIs.

---

## 9. Where to practice in this project

- **One place to try everything:** `app/learn-react/page.tsx`. It has a counter (state + onClick), an input that mirrors text (state + onChange), and a list (array state + map). Edit it, break it, fix it.
- **Add a new "room":** Create `app/my-page/page.tsx` and export a default function that returns JSX. Go to `http://localhost:3000/my-page`.
- **Reusable UI:** Use components from `@/components/ui` (Button, Card, Input) and pass props. When you’re ready, add your own small components in the same file or in `components/`.

---

## 10. Cheat sheet (copy when building)

| I want to…              | Use this |
|-------------------------|----------|
| Show changing data      | `useState(initial)`, then `{value}` in JSX |
| Update that data        | Call `setValue(newValue)` (e.g. in onClick/onChange) |
| React to a click        | `onClick={() => doSomething()}` |
| React to typing         | `value={text}` + `onChange={(e) => setText(e.target.value)}` |
| Render a list           | `{items.map((item, i) => <div key={i}>...</div>)}` |
| Pass options to a component | Props: `function Comp({ title }) { ... }` and `<Comp title="Hi" />` |
| Style something         | `className="flex gap-4 p-4 rounded-lg bg-muted"` |
| Use a built-in block    | Import from `@/components/ui`: `<Button>`, `<Card>`, `<Input>` |

Once this feels familiar, you can build small screens and components on your own and look up details as you go.
