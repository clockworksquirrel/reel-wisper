# 🎬 ReeL Wisper

AI-powered natural language movie & TV discovery for [Stremio](https://www.stremio.com/).

Describe what you want to watch — an actor, a vibe, a half-remembered plot — and ReeL Wisper uses an LLM to find it, then resolves everything against TMDB and TVDB for accurate metadata.

## Features

- **Natural language search** — "movies where the villain wins", "that one where the guy wakes up every day", "Leonardo DiCaprio"
- **Bring your own LLM** — OpenAI, Google Gemini, OpenRouter, or any OpenAI-compatible API
- **Smart resolution** — LLM suggestions are resolved against TMDB with TVDB fallback
- **Encrypted config** — Your API keys are AES-256-GCM encrypted in the addon URL, never stored server-side
- **Direct search fallback** — If the LLM fails, falls back to TMDB multi-search (actors, directors, titles)
- **Zero config for TMDB** — TMDB and TVDB keys are server-side, users only need an LLM API key

## How It Works

1. You enter a natural language query in Stremio's search bar
2. ReeL Wisper sends it to your configured LLM (OpenAI, Gemini, etc.)
3. The LLM returns structured suggestions (title, year, type)
4. Each suggestion is resolved against TMDB → TVDB to get IMDB IDs and poster art
5. Results appear in Stremio with full metadata

## Install

1. Go to [reel-wisper.fly.dev](https://reel-wisper.fly.dev)
2. Pick your LLM provider and enter your API key
3. Click **Generate Addon URL**
4. Click **Install in Stremio**

That's it. Search for anything in Stremio and ReeL Wisper handles the rest.

## Self-Hosting

```bash
git clone https://github.com/clockworksquirrel/reel-wisper.git
cd reel-wisper
npm install
```

Create a `.env` file:

```env
PORT=4000
TMDB_API_KEY=your_tmdb_api_key
TVDB_API_KEY=your_tvdb_api_key
CONFIG_SECRET=any-random-secret-string-for-encryption
```

Run it:

```bash
npm start
```

### Deploy to Fly.io

```bash
fly launch
fly secrets set TMDB_API_KEY=xxx TVDB_API_KEY=xxx CONFIG_SECRET=xxx
fly deploy
```

## Supported Providers

| Provider | Base URL | Free Tier |
|----------|----------|-----------|
| OpenAI | `https://api.openai.com/v1` | No |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | Yes |
| OpenRouter | `https://openrouter.ai/api/v1` | Some models |
| Custom | Any OpenAI-compatible endpoint | Varies |

## Tech Stack

- **Runtime:** Node.js + Express
- **LLM:** Any OpenAI-compatible chat completions API
- **Metadata:** TMDB API + TVDB API v4
- **Encryption:** AES-256-GCM for config tokens
- **Hosting:** Fly.io (Docker)

## License

MIT
