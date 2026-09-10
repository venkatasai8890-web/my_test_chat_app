# App Architecture

This app is a small Next.js App Router chat application with a single interactive client surface and one server-side API route.

The editable Draw.io source lives in [ARCHITECTURE.drawio](/Users/bhogaai/my_test_chat_app/ARCHITECTURE.drawio).

## Diagram

```mermaid
flowchart LR
  U[User in browser] --> P[App Router page<br/>app/page.tsx]
  P --> L[Root layout<br/>app/layout.tsx]
  P --> C[Client chat UI<br/>app/components/Chat.tsx]

  C <-->|local state: conversations, settings, input, loading| C
  C -->|opens| SP[Settings panel<br/>app/components/ChatSettingsPanel.tsx]
  SP -->|reads defaults + labels| CS[app/lib/chatSettings.ts]
  SP -->|per-field help| TT[Tooltip<br/>app/components/Tooltip.tsx]
  SP -->|updates| C

  C -->|POST /api/chat<br/>JSON: { messages, settings }| R[Route handler<br/>app/api/chat/route.ts]

  R -->|reads defaults + clamps ranges| CS
  R -->|reads| E[GOOGLE_GENAI_API_KEY<br/>environment variable]
  R -->|SDK call| G[@google/genai<br/>GoogleGenAI]
  G -->|generateContent<br/>model + config| M[Selected Gemini model<br/>e.g. gemini-3-flash-preview]
  M -->|response text| R
  R -->|JSON: { text }| C

  L -->|loads global styles + fonts| S[app/globals.css]
```

## Chat Settings

The settings panel (`app/components/ChatSettingsPanel.tsx`) lets the user configure generation behavior per session, with a tooltip (`app/components/Tooltip.tsx`) on every field explaining what it does. Types, defaults, the model list, and tooltip copy live in `app/lib/chatSettings.ts` and are shared by both the client panel and the server route, so client and server never disagree on defaults or valid ranges.

- **Model selection dropdown** - chooses which Gemini model handles the request (replaces the old hardcoded `gemini-3-flash-preview`).
- **Temperature** - randomness of the output (0-2).
- **Top K** - restricts sampling to the K most probable next tokens.
- **Top P** - nucleus sampling threshold (0-1).
- **Output Tokens** - maximum tokens generated in the response.
- **Frequency Penalty** - penalizes tokens by how often they've already appeared (-2 to 2).
- **Presence Penalty** - penalizes tokens that have appeared at all so far (-2 to 2).
- **Stop Sequence** - a string that ends generation early if produced.
- **Seed** - fixes the random seed for more reproducible responses.

`Chat.tsx` sends both `messages` and the current `settings` object in the `POST /api/chat` body. `app/api/chat/route.ts` merges the incoming settings with defaults, validates and clamps each value to its documented range, builds the Gemini `GenerateContentConfig` from them, and calls `generateContent` with the **user-selected model** rather than a hardcoded string.

## Request Flow

1. The browser opens `/`, which is rendered by `app/page.tsx`.
2. `app/page.tsx` returns the `Chat` client component.
3. `Chat.tsx` manages conversation state (messages, settings, UI state) in the browser with React hooks.
4. The user can open the settings panel (`ChatSettingsPanel.tsx`) to choose the Gemini model and tune generation parameters: temperature, Top K, Top P, output tokens, frequency penalty, presence penalty, stop sequence, and seed. Each field has a tooltip (`Tooltip.tsx`) explaining what it does, sourced from `app/lib/chatSettings.ts`.
5. On submit, the client sends the full message history plus the current `settings` object to `POST /api/chat`.
6. `app/api/chat/route.ts` runs on the server: it reads `GOOGLE_GENAI_API_KEY`, merges the incoming settings with defaults, clamps each value to its valid range (defense in depth against untrusted client input), and builds a Gemini `GenerateContentConfig`.
7. The route calls `@google/genai` with the selected model and config.
8. The server returns the generated text to the client, which appends it to the message list.

## Key Boundaries

- `app/page.tsx` is a server component by default.
- `app/components/Chat.tsx` is a client component because it uses `useState`, `useRef`, and `useEffect`.
- `app/components/ChatSettingsPanel.tsx` and `app/components/Tooltip.tsx` are client components (interactive form controls and hover/focus state).
- `app/lib/chatSettings.ts` holds shared, environment-agnostic constants (types, defaults, model list, tooltip copy) imported by both the client settings panel and the server route, so the two never drift out of sync.
- `app/api/chat/route.ts` is server-only, keeps the API key out of the browser bundle, and re-validates/clamps settings rather than trusting client-sent values.
- `app/layout.tsx` applies the shared document shell, fonts, and metadata.

## Main Files

- `app/page.tsx` - entry point for `/`
- `app/layout.tsx` - root HTML shell and metadata
- `app/components/Chat.tsx` - interactive chat UI
- `app/components/ChatSettingsPanel.tsx` - modal for model + generation parameter settings
- `app/components/Tooltip.tsx` - reusable hover/focus tooltip used by the settings panel
- `app/lib/chatSettings.ts` - settings types, defaults, model options, and tooltip copy shared by client and server
- `app/api/chat/route.ts` - Gemini API bridge; builds the generation config from settings
- `app/globals.css` - global styling and theme tokens
