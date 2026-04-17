"""Voice agent that coordinates research via parallel workers."""

import asyncio
import os
import uuid
from datetime import UTC, datetime

from loguru import logger
from pipecat.frames.frames import LLMMessagesAppendFrame
from pipecat.processors.frame_processor import FrameDirection
from pipecat.processors.frameworks.rtvi import RTVIServerMessageFrame
from pipecat.services.llm_service import (
    FunctionCallParams,
    FunctionCallResultProperties,
    LLMService,
)
from pipecat.services.openai.base_llm import OpenAILLMSettings
from pipecat.services.openai.llm import OpenAILLMService
from pipecat_subagents.agents import LLMAgent, tool
from pipecat_subagents.bus import AgentBus, BusFrameMessage

from research_coordinator import ResearchCoordinator
from speaking_state import SpeakingStateObserver


class VoiceAgent(LLMAgent):
    """Voice agent that dispatches research queries to a coordinator."""

    _BATCH_DEBOUNCE_SECS = 0.5

    def __init__(self, name: str, *, bus: AgentBus, speaking_state: SpeakingStateObserver | None = None):
        super().__init__(name, bus=bus, bridged=())
        self._speaking_state = speaking_state
        self._pending_results: dict[str, dict] = {}
        self._announced_results: set[str] = set()
        self._announce_wakeup = asyncio.Event()
        self._announcer_task: asyncio.Task | None = None

    def build_llm(self) -> LLMService:
        return OpenAILLMService(
            api_key=os.getenv("OPENAI_API_KEY"),
            settings=OpenAILLMSettings(
                model=os.getenv("OPENAI_MODEL"),
                system_instruction=(
                    "You are a voice-controlled research assistant. You have access to a research "
                    "tool that dispatches parallel workers to gather current information from the web.\n\n"
                    "DECIDING WHEN TO RESEARCH:\n"
                    "- If the user's question can be fully and accurately answered from general "
                    "knowledge (e.g. 'what is photosynthesis', 'explain recursion', 'who wrote "
                    "Hamlet'), answer directly without calling any tool.\n"
                    "- Call the research tool when the question involves current events, recent "
                    "data, specific facts you're unsure about, or any topic where freshness "
                    "matters.\n\n"
                    "CHOOSING DEPTH (per-worker effort):\n"
                    "- 'quick': a single fact or current datapoint\n"
                    "- 'standard': most questions needing context, comparison, or a few sources\n"
                    "- 'deep': questions requiring synthesis across many sources or nuanced analysis\n\n"
                    "CHOOSING SUBTOPIC COUNT (breadth, 1-4):\n"
                    "Pick the SMALLEST number of subtopics that covers the question's distinct "
                    "dimensions. Start at 1 and only add more when the question clearly decomposes "
                    "into non-overlapping angles a single search would miss. Do not pad to sound "
                    "thorough. Depth and count are independent: a 'deep' question can need only 1 "
                    "subtopic, and a 'standard' question can need 3.\n"
                    "- 1 subtopic: a single question, even if it needs deep research "
                    "(e.g. 'current Bitcoin price', 'who won last night's game', "
                    "'latest AI regulations in the EU')\n"
                    "- 2 subtopics: a comparison or two linked questions "
                    "(e.g. 'compare React and Vue in 2026', 'pros and cons of remote work')\n"
                    "- 3 subtopics: three genuinely distinct facets "
                    "(e.g. 'how is GPT-5 different from Claude and Gemini', covering each model)\n"
                    "- 4 subtopics: only for questions that clearly span four separate dimensions "
                    "(e.g. 'economic impact of remote work on urban housing markets' covering "
                    "rents, commercial vacancy, suburban migration, and municipal tax base)\n"
                    "Counter-example: 'latest AI regulations' is ONE subtopic, not three. Don't "
                    "split it into 'EU rules', 'US rules', 'China rules' unless the user asked "
                    "about specific regions.\n\n"
                    "IMPORTANT: Only call the research tool ONCE per response. Never issue "
                    "multiple research calls in the same turn. If the user asks a new question "
                    "while research is in progress, wait for the current research to finish "
                    "before starting new research.\n\n"
                    "After each research round completes you MUST call update_summary with the "
                    "group_id from the research result to send a summary and key findings for "
                    "that specific query to the UI.\n\n"
                    "DEFERRED RESEARCH RESULTS:\n"
                    "When you're mid-utterance and a background research result lands, it gets held "
                    "and surfaced later via a developer message that says background research is "
                    "ready on one or more topics with their pending_ids. Give the user a brief "
                    "heads-up naming the topic(s) and ask which they'd like to hear. If one topic: "
                    "ask if they want it. If several: list them and let the user pick one, several, "
                    "or all. Do NOT reveal the findings yet. For each topic they confirm, call "
                    "get_pending_result with that pending_id (issue the calls in parallel when they "
                    "pick multiple). If they decline or change the subject, drop it. Only call "
                    "update_summary after the full details have actually been delivered to the user, "
                    "never after just the heads-up.\n\n"
                    "When speaking, be concise and conversational. Don't read out URLs or sources.\n"
                ),
            ),
        )

    async def on_ready(self) -> None:
        await super().on_ready()
        await self.add_agent(ResearchCoordinator("coordinator", bus=self.bus))
        self._announcer_task = self.create_asyncio_task(
            self._announcer_loop(), name=f"{self.name}::deferred_announcer"
        )

    async def _send_frontend_message(self, data: dict):
        """Send an RTVIServerMessageFrame to the client via the bus."""
        await self.send_message(
            BusFrameMessage(
                source=self.name,
                target="main",
                frame=RTVIServerMessageFrame(data=data),
                direction=FrameDirection.DOWNSTREAM,
            )
        )

    @tool(cancel_on_interruption=False, timeout=120)
    async def research(self, params: FunctionCallParams, query: str, subtopics: list[str], depth: str = "standard"):
        """Research a topic by dispatching parallel workers to gather information.

        Args:
            query (str): The main research query from the user.
            subtopics (list[str]): 1-4 focused subtopics to research in parallel.
            depth (str): 'quick', 'standard', or 'deep'. Controls how thoroughly each worker researches.
        """
        group_id = str(uuid.uuid4())
        logger.info(f"Agent '{self.name}': researching '{query}' with {len(subtopics)} subtopics")

        tasks = [
            {"taskId": f"{group_id[:8]}_{i}", "topic": topic, "status": "pending"}
            for i, topic in enumerate(subtopics)
        ]

        now = datetime.now(UTC).isoformat()

        await self._send_frontend_message(
            {
                "type": "task_group_started",
                "timestamp": now,
                "groupId": group_id,
                "query": query,
                "tasks": tasks,
            }
        )

        await self._send_frontend_message(
            {
                "type": "agent_event",
                "timestamp": now,
                "agent": self.name,
                "agentType": "LLMAgent",
                "event": "task_dispatched",
                "target": "coordinator",
                "groupId": group_id,
                "detail": f'task("coordinator", query="{query}")',
            }
        )

        payload = {
            "query": query,
            "subtopics": subtopics,
            "group_id": group_id,
            "depth": depth,
        }

        async with self.task("coordinator", payload=payload, timeout=120) as task:
            await params.llm.queue_frame(
                LLMMessagesAppendFrame(
                    messages=[{"role": "developer", "content": "Let me research that for you."}],
                    run_llm=True,
                )
            )
            async for event in task:
                if event.data:
                    await self._send_frontend_message(event.data)

        await self._send_frontend_message(
            {
                "type": "task_group_completed",
                "timestamp": datetime.now(UTC).isoformat(),
                "groupId": group_id,
            }
        )

        results = task.response

        if self._speaking_state and self._speaking_state.is_bot_speaking:
            # Hand off to the background announcer and return immediately, so the
            # tool's timeout budget only covers worker execution rather than also
            # absorbing the wait for a clean idle moment.
            self._pending_results[group_id] = {"query": query, "results": results}
            self._announce_wakeup.set()
            await params.result_callback(
                f"(Research on '{query}' deferred for batched announce.)",
                properties=FunctionCallResultProperties(run_llm=False),
            )
            return

        await params.result_callback(f"Research complete (group_id={group_id}) for '{query}'. Results: {results}")

    async def _announcer_loop(self) -> None:
        """Background task that batches deferred research results and announces them
        on the next clean bot-idle moment. Decoupled from any tool call so the
        announce wait isn't bounded by the tool's timeout."""
        while True:
            await self._announce_wakeup.wait()
            self._announce_wakeup.clear()

            if not self._speaking_state or not self._llm:
                continue

            await self._speaking_state.wait_until_bot_stops()
            await asyncio.sleep(self._BATCH_DEBOUNCE_SECS)

            new_ids = [gid for gid in self._pending_results if gid not in self._announced_results]
            if not new_ids:
                continue

            self._announced_results.update(new_ids)
            topics = ", ".join(f"'{self._pending_results[gid]['query']}'" for gid in new_ids)
            ids_str = ", ".join(new_ids)
            await self._llm.queue_frame(
                LLMMessagesAppendFrame(
                    messages=[
                        {
                            "role": "developer",
                            "content": (
                                f"Background research is ready on: {topics}. Give the user a "
                                f"brief heads-up listing these topics and ask which they'd like "
                                f"to hear. They can pick one, several, or all. For each topic "
                                f"they confirm, call get_pending_result(group_id=<id>). "
                                f"pending_ids=[{ids_str}]"
                            ),
                        }
                    ],
                    run_llm=True,
                )
            )

    @tool()
    async def get_pending_result(self, params: FunctionCallParams, group_id: str):
        """Retrieve the full details of a previously-announced background research result.
        Call this when the user confirms they want to hear a pending research result.

        Args:
            group_id (str): The pending_id from the deferred research announcement.
        """
        payload = self._pending_results.pop(group_id, None)
        self._announced_results.discard(group_id)
        if not payload:
            await params.result_callback(f"No pending result found for {group_id}.")
            return
        await params.result_callback(
            f"Full research for '{payload['query']}' (group_id={group_id}): {payload['results']}"
        )

    @tool()
    async def update_summary(
        self, params: FunctionCallParams, group_id: str, summary: str, key_findings: list[str]
    ):
        """Update the research summary displayed in the UI. Call this AFTER each
        research round completes to provide the user with a summary for that query.

        Args:
            group_id (str): The group_id from the completed research call.
            summary (str): A summary of the research findings for this query.
            key_findings (list[str]): The most important findings as bullet points.
        """
        logger.info(f"Agent '{self.name}': updating summary ({len(key_findings)} findings)")

        await self._send_frontend_message(
            {
                "type": "summary_update",
                "timestamp": datetime.now(UTC).isoformat(),
                "groupId": group_id,
                "summary": summary,
                "keyFindings": key_findings,
            }
        )

        await params.result_callback("Summary updated in the UI.")
