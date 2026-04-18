# Research Assistant

A voice-controlled research assistant that dispatches background workers to gather information from the web, then surfaces results conversationally without interrupting an in-progress turn. Built as a technical demonstration of async task patterns in [Pipecat Subagents](https://github.com/pipecat-ai/pipecat-subagents): dynamic agent provisioning, conversational timing, and observability of agent actions in a real-time voice loop.

## What this demonstrates

- **Dynamic agent provisioning.** A `VoiceAgent` (LLM + tools) dispatches work to a `ResearchCoordinator` which spawns one `ResearchWorker` per subtopic in parallel. Workers are real Claude Agent SDK sessions with web tools.
- **Conversational timing.** When a worker finishes while the bot is mid-utterance, the result is held instead of interrupting. A `SpeakingStateObserver` watches `BotStartedSpeakingFrame` / `BotStoppedSpeakingFrame` / `InterruptionFrame` so deferred announcements only fire on a clean idle moment, not after a user interruption. Multiple results landing close together get batched into a single heads-up.
- **Decoupled async work from tool lifecycle.** The research tool returns immediately when its workers finish; a long-lived background announcer task owns the wait-and-speak. The tool's timeout budget covers worker execution only, not the indefinite wait for a conversational opening.
- **Live observability.** The UI shows worker status, tool calls, token usage, and per-task elapsed time in real time as the agents work.

## Architecture

```
ResearchAssistant (transport + bus bridge)
  └── VoiceAgent (LLM, bridged)
        └── @tool research(query, subtopics, depth)
              └── ResearchCoordinator
                    └── task_group(worker_0..N)
                          └── ResearchWorker (Claude Agent SDK)
```

The voice agent and its background announcer task live in `server/voice_agent.py`. The speaking-state observer is in `server/speaking_state.py`. Pipeline wiring is in `server/bot.py`.

## Requirements

API keys (server-side, set in `server/.env`):

- `OPENAI_API_KEY` — voice agent LLM (OpenAI)
- `ANTHROPIC_API_KEY` — research workers (Claude Agent SDK)
- `SONIOX_API_KEY` — speech-to-text
- `CARTESIA_API_KEY` — text-to-speech
- `DAILY_API_KEY` — optional, only if using Daily transport

Client config (set in `client/.env`):

- `VITE_TRANSPORT` — `smallwebrtc` (default) or `daily`

Templates exist at `server/.env.example` and `client/.env.example`. Copy them to `.env` and fill in keys.

## How to run

**Terminal 1 — server:**

```sh
cd server
uv sync
uv run bot.py
```

**Terminal 2 — client:**

```sh
cd client
npm install
npm run dev
```

Open http://localhost:5173/ and click connect.

## Sample questions

Try these to see different patterns in action:

- *"What's the current price of bitcoin?"* — single quick lookup, single worker.
- *"Compare React and Vue in 2026."* — two parallel subtopics.
- *"What's the latest on AI regulations across the EU, US, and China?"* — three parallel workers, batched summary.
- To see the batching/deferred-announce flow: ask a slow research query (e.g. *"research the history of compiler design deeply"*), then while it's running, ask something the agent can answer from general knowledge (e.g. *"what's seventeen times twenty-three?"*). When the research finishes, the agent will wait for its current answer to end, then say something like *"Heads up — I finished that compiler research. Want to hear it?"*

## Project structure

```
server/                  Python backend
  bot.py                 Pipeline + transport wiring
  voice_agent.py         VoiceAgent (LLM, tools, deferred announcer)
  speaking_state.py      Observer tracking bot speaking state
  research_coordinator.py  Coordinator that spawns parallel workers
  research_worker.py     Per-subtopic Claude Agent SDK worker
client/                  React + Vite + Tailwind frontend
  src/components/        TaskGroupCard, AgentDashboard, ResearchPanel
  src/context/           Reducer state for research tasks
```
