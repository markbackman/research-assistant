"""Voice agent that coordinates research via parallel workers."""

import os
import uuid
from datetime import datetime, timezone

from loguru import logger
from pipecat.frames.frames import LLMMessagesAppendFrame
from pipecat.processors.frame_processor import FrameDirection
from pipecat.processors.frameworks.rtvi import RTVIServerMessageFrame
from pipecat.services.llm_service import FunctionCallParams, LLMService
from pipecat.services.openai.base_llm import OpenAILLMSettings
from pipecat.services.openai.llm import OpenAILLMService
from pipecat_subagents.agents import LLMAgent, tool
from pipecat_subagents.bus import AgentBus, BusFrameMessage

from research_coordinator import ResearchCoordinator


class VoiceAgent(LLMAgent):
    """Voice agent that dispatches research queries to a coordinator."""

    def __init__(self, name: str, *, bus: AgentBus):
        super().__init__(name, bus=bus, bridged=())

    def build_llm(self) -> LLMService:
        return OpenAILLMService(
            api_key=os.getenv("OPENAI_API_KEY"),
            settings=OpenAILLMSettings(
                model=os.getenv("OPENAI_MODEL"),
                system_instruction=(
                    "You are a voice-controlled research assistant. When the user asks about "
                    "a topic, decompose it into 2-4 focused subtopics and call the research tool. "
                    "Each subtopic should cover a distinct angle of the query.\n\n"
                    "After each research round completes you MUST call update_summary to send "
                    "a cumulative summary and key findings to the UI. The summary should "
                    "incorporate ALL research collected so far, not just the latest round.\n\n"
                    "When speaking the results, give a concise verbal overview. Keep responses "
                    "natural and conversational for voice. Don't read out URLs or sources.\n"
                ),
            ),
        )

    async def on_ready(self) -> None:
        await super().on_ready()
        await self.add_agent(ResearchCoordinator("coordinator", bus=self.bus))

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
    async def research(self, params: FunctionCallParams, query: str, subtopics: list[str]):
        """Research a topic by dispatching parallel workers to gather information.

        Args:
            query (str): The main research query from the user.
            subtopics (list[str]): A list of 2-4 focused subtopics to research in parallel.
        """
        group_id = str(uuid.uuid4())
        logger.info(f"Agent '{self.name}': researching '{query}' with {len(subtopics)} subtopics")

        tasks = [
            {"taskId": f"{group_id[:8]}_{i}", "topic": topic, "status": "pending"}
            for i, topic in enumerate(subtopics)
        ]

        now = datetime.now(timezone.utc).isoformat()

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

        await params.llm.queue_frame(
            LLMMessagesAppendFrame(
                messages=[{"role": "developer", "content": "Let me research that for you."}],
                run_llm=True,
            )
        )

        payload = {
            "query": query,
            "subtopics": subtopics,
            "group_id": group_id,
        }

        async with self.task("coordinator", payload=payload, timeout=120) as task:
            async for event in task:
                if event.data:
                    await self._send_frontend_message(event.data)

        await self._send_frontend_message(
            {
                "type": "task_group_completed",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "groupId": group_id,
            }
        )

        results = task.response
        await params.result_callback(f"Research complete for '{query}'. Results: {results}")

    @tool()
    async def update_summary(
        self, params: FunctionCallParams, summary: str, key_findings: list[str]
    ):
        """Update the research summary displayed in the UI. Call this AFTER each
        research round completes to provide the user with a cumulative overview.

        Args:
            summary (str): A comprehensive summary incorporating ALL research so far.
            key_findings (list[str]): The most important findings as bullet points.
        """
        logger.info(f"Agent '{self.name}': updating summary ({len(key_findings)} findings)")

        await self._send_frontend_message(
            {
                "type": "summary_update",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "summary": summary,
                "keyFindings": key_findings,
            }
        )

        await params.result_callback("Summary updated in the UI.")
