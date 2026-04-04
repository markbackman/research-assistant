"""Research worker that uses Claude Agent SDK to research a subtopic."""

import asyncio
from datetime import datetime, timezone
from typing import Optional

from loguru import logger
from pipecat_subagents.agents import BaseAgent
from pipecat_subagents.agents.task_context import TaskStatus
from pipecat_subagents.bus import AgentBus

try:
    from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient
except ModuleNotFoundError as e:
    logger.error(f"Exception: {e}")
    logger.error(
        "In order to use ResearchWorker, you need to `pip install pipecat-ai-subagents[examples]`."
    )
    raise Exception(f"Missing module: {e}")


class ResearchWorker(BaseAgent):
    """Worker that researches a subtopic using Claude Agent SDK with web tools.

    Each worker gets a focused subtopic and uses WebSearch + WebFetch to
    gather information, returning structured research results.
    """

    def __init__(
        self,
        name: str,
        *,
        bus: AgentBus,
        subtopic: str,
        query: str,
        group_id: str,
        worker_index: int,
    ):
        super().__init__(name, bus=bus)
        self._subtopic = subtopic
        self._query = query
        self._group_id = group_id
        self._worker_index = worker_index
        self._task_id = f"{group_id[:8]}_{worker_index}"

        self._queue: asyncio.Queue[dict] = asyncio.Queue()
        self._worker_task: Optional[asyncio.Task] = None

        self._claude_options = ClaudeAgentOptions(
            permission_mode="bypassPermissions",
            system_prompt=(
                "You are a research assistant focused on gathering information about a "
                "specific subtopic. Use WebSearch to find relevant information and WebFetch "
                "to read promising pages.\n\n"
                "Your task:\n"
                f"- Main query: {query}\n"
                f"- Your subtopic: {subtopic}\n\n"
                "Research this subtopic thoroughly. Find 2-4 high-quality sources.\n\n"
                "IMPORTANT: Your final response must be ONLY a JSON object with this structure "
                "(no other text):\n"
                "{\n"
                '  "topic": "the subtopic you researched",\n'
                '  "summary": "a 2-3 paragraph summary of findings",\n'
                '  "sources": ["url1", "url2", ...]\n'
                "}\n"
            ),
            allowed_tools=["WebSearch", "WebFetch"],
            model="sonnet",
            max_turns=15,
        )

    async def on_ready(self):
        await super().on_ready()
        self._worker_task = self.create_asyncio_task(self._worker_loop(), f"{self.name}::worker")

    async def on_finished(self) -> None:
        await super().on_finished()
        if self._worker_task:
            await self.cancel_asyncio_task(self._worker_task)
            self._worker_task = None

    async def on_task_request(self, message):
        await super().on_task_request(message)
        logger.info(f"Worker '{self.name}': received task for '{self._subtopic}'")
        self._queue.put_nowait(message.payload)

    async def _worker_loop(self):
        try:
            async with ClaudeSDKClient(options=self._claude_options) as client:
                while True:
                    payload = await self._queue.get()
                    logger.info(f"Worker '{self.name}': researching '{self._subtopic}'")

                    now = datetime.now(timezone.utc).isoformat()

                    await self.send_task_update(
                        {
                            "type": "agent_event",
                            "timestamp": now,
                            "agent": self.name,
                            "agentType": "BaseAgent",
                            "event": "worker_started",
                            "groupId": self._group_id,
                            "detail": f'worker_started("{self._subtopic}")',
                        }
                    )

                    await self.send_task_update(
                        {
                            "type": "task_update",
                            "timestamp": now,
                            "groupId": self._group_id,
                            "taskId": self._task_id,
                            "status": "running",
                            "detail": f"Researching: {self._subtopic}",
                        }
                    )

                    try:
                        answer = ""
                        await client.query(
                            prompt=(
                                f"Research the following subtopic: {self._subtopic}\n"
                                f"This is part of a broader research query: {self._query}\n"
                                "Find relevant, current information and return structured results."
                            )
                        )
                        async for msg in client.receive_response():
                            if type(msg).__name__ == "AssistantMessage":
                                for block in msg.content:
                                    if type(block).__name__ == "TextBlock":
                                        answer += block.text
                                    elif type(block).__name__ == "ToolUseBlock":
                                        tool_input = {}
                                        if hasattr(block, "input") and isinstance(block.input, dict):
                                            tool_input = block.input
                                        await self.send_task_update(
                                            {
                                                "type": "worker_tool_call",
                                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                                "groupId": self._group_id,
                                                "taskId": self._task_id,
                                                "tool": block.name,
                                                "input": tool_input,
                                            }
                                        )

                        logger.info(f"Worker '{self.name}': completed ({len(answer)} chars)")

                        # Try to parse as JSON, fall back to raw text
                        import json

                        try:
                            result = json.loads(answer)
                        except json.JSONDecodeError:
                            result = {
                                "topic": self._subtopic,
                                "summary": answer,
                                "sources": [],
                            }

                        completed_at = datetime.now(timezone.utc).isoformat()

                        await self.send_task_update(
                            {
                                "type": "research_result",
                                "timestamp": completed_at,
                                "groupId": self._group_id,
                                "taskId": self._task_id,
                                "topic": result.get("topic", self._subtopic),
                                "summary": result.get("summary", answer),
                                "sources": result.get("sources", []),
                            }
                        )

                        await self.send_task_update(
                            {
                                "type": "task_update",
                                "timestamp": completed_at,
                                "groupId": self._group_id,
                                "taskId": self._task_id,
                                "status": "completed",
                            }
                        )

                        await self.send_task_update(
                            {
                                "type": "agent_event",
                                "timestamp": completed_at,
                                "agent": self.name,
                                "agentType": "BaseAgent",
                                "event": "worker_completed",
                                "groupId": self._group_id,
                                "detail": f'worker_completed("{self._subtopic}")',
                            }
                        )

                        await self.send_task_response(result)

                    except Exception as e:
                        logger.error(f"Worker '{self.name}': error: {e}")
                        error_at = datetime.now(timezone.utc).isoformat()
                        await self.send_task_update(
                            {
                                "type": "task_update",
                                "timestamp": error_at,
                                "groupId": self._group_id,
                                "taskId": self._task_id,
                                "status": "error",
                                "detail": str(e),
                            }
                        )
                        await self.send_task_update(
                            {
                                "type": "agent_event",
                                "timestamp": error_at,
                                "agent": self.name,
                                "agentType": "BaseAgent",
                                "event": "worker_error",
                                "groupId": self._group_id,
                                "detail": f'worker_error("{self._subtopic}", "{e}")',
                            }
                        )
                        await self.send_task_response({"error": str(e)}, status=TaskStatus.ERROR)

        except Exception as e:
            logger.error(f"Worker '{self.name}': failed to start Claude SDK: {e}")
