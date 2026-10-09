# CodePilot — AI Code Optimization Assistant

A Cloudflare-native AI chat application for explaining and improving the performance of Python, C++, and CUDA code. **Not a benchmarking or code-execution service**: suggestions are hypotheses until measured.

## Features
- User-submitted code or questions through a responsive chat interface
- Llama 3.3 70B on **Cloudflare Workers AI**
- **Cloudflare Worker** coordinates model calls, conversation lookup, input validation, and persistence
- **D1** SQL database stores conversation history across refreshes, scoped to a browser session cookie
- Follow-up context (up to 12 previous messages) and reset conversation action
- Plain-text model display prevents generated HTML from executing

## Cloudflare assignment requirements
| Requirement | Implementation |
| --- | --- |
| LLM | Workers AI / Llama 3.3 |
| Coordination | Worker fetch handler |
| User input | Responsive web chat, served as static Worker assets |
| Memory/state | D1 persisted messages and session cookie |

## Local setup
Requires Node.js 20+, npm, and a Cloudflare account.

1. `npm install`
2. `npx wrangler login`
3. `npx wrangler d1 create code-coach-db`
4. Copy the new `database_id` into the D1 entry in `wrangler.jsonc` (replace `REPLACE_WITH_YOUR_D1_DATABASE_ID`). Never deploy with the placeholder.
5. `npm run db:local`
6. `npm run dev`
7. Visit the local URL shown by Wrangler.

## Deploy
1. `npm run db:remote` (creates the tables in the production D1 database)
2. `npm run deploy`
3. Open the deployed `*.workers.dev` URL printed by Wrangler.

**Important:** Workers AI usage may incur charges beyond free allowances. Review your account's Cloudflare usage and pricing. Production deployments should add rate limiting and user authentication; this demo deliberately uses only an anonymous, per-browser session cookie. The cookie is not a replacement for sign-in and should not store sensitive code. The app does not execute submitted code.

## Testing
- `npm run check` checks JavaScript syntax.
- `npm test` runs lightweight API tests.
- After binding the services, test chat, refresh history, and reset in the browser.

## Architecture
```
Browser chat (HTML/CSS/JS)
       | fetch('/api/chat')
Cloudflare Worker
       |-- D1 -> read last 12 messages, store exchange
       `-- Workers AI -> Llama 3.3 70B
```

## Prompt history
See [`PROMPT_HISTORY.md`](./PROMPT_HISTORY.md). The user must add any later AI-assisted edits and prompts they use before submitting. The record documents the request that led to this initial generation, rather than fabricating prompts.

## Documentation
- [Cloudflare Workers AI model](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)
- [D1 setup](https://developers.cloudflare.com/d1/get-started/)
- [Worker static assets](https://developers.cloudflare.com/workers/static-assets/binding/)
