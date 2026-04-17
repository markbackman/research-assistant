"""Research worker that uses Claude Agent SDK to research a subtopic."""

import asyncio
import time
from datetime import UTC, datetime

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
        depth: str = "standard",
    ):
        super().__init__(name, bus=bus)
        self._subtopic = subtopic
        self._query = query
        self._group_id = group_id
        self._worker_index = worker_index
        self._task_id = f"{group_id[:8]}_{worker_index}"
        self._depth = depth

        self._queue: asyncio.Queue = asyncio.Queue()
        self._worker_task: asyncio.Task | None = None

        depth_config = {
            "quick":    {"max_turns": 6,  "sources": "1-2"},
            "standard": {"max_turns": 15, "sources": "2-4"},
            "deep":     {"max_turns": 20, "sources": "3-5"},
        }
        config = depth_config.get(depth, depth_config["standard"])

        self._claude_options = ClaudeAgentOptions(
            permission_mode="bypassPermissions",
            system_prompt=(
                "You are a research assistant focused on gathering information about a "
                "specific subtopic. Use WebSearch to find relevant information and WebFetch "
                "to read promising pages.\n\n"
                "Your task:\n"
                f"- Main query: {query}\n"
                f"- Your subtopic: {subtopic}\n"
                f"- Research depth: {depth}\n\n"
                f"Research this subtopic {'briefly and efficiently' if depth == 'quick' else 'thoroughly'}. "
                f"Find {config['sources']} high-quality sources.\n\n"
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
            max_turns=config["max_turns"],
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
        self._queue.put_nowait(message)

    async def _worker_loop(self):
        try:
            async with ClaudeSDKClient(options=self._claude_options) as client:
                while True:
                    message = await self._queue.get()
                    task_id = message.task_id
                    logger.info(f"Worker '{self.name}': researching '{self._subtopic}'")

                    now = datetime.now(UTC).isoformat()

                    await self.send_task_update(
                        task_id,
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
                        task_id,
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
                        query_started_at = time.monotonic()
                        first_assistant_at: float | None = None
                        input_tokens: int | None = None
                        output_tokens: int | None = None

                        await client.query(
                            prompt=(
                                f"Research the following subtopic: {self._subtopic}\n"
                                f"This is part of a broader research query: {self._query}\n"
                                "Find relevant, current information and return structured results."
                            )
                        )
                        async for msg in client.receive_response():
                            msg_type = type(msg).__name__
                            if msg_type == "AssistantMessage":
                                if first_assistant_at is None:
                                    first_assistant_at = time.monotonic()
                                for block in msg.content:
                                    if type(block).__name__ == "TextBlock":
                                        answer += block.text
                                    elif type(block).__name__ == "ToolUseBlock":
                                        tool_input = {}
                                        if hasattr(block, "input") and isinstance(block.input, dict):
                                            tool_input = block.input
                                        await self.send_task_update(
                                            task_id,
                                            {
                                                "type": "worker_tool_call",
                                                "timestamp": datetime.now(UTC).isoformat(),
                                                "groupId": self._group_id,
                                                "taskId": self._task_id,
                                                "tool": block.name,
                                                "input": tool_input,
                                            },
                                        )
                            elif msg_type == "ResultMessage":
                                usage = getattr(msg, "usage", None)
                                if isinstance(usage, dict):
                                    input_tokens = usage.get("input_tokens")
                                    output_tokens = usage.get("output_tokens")

                        duration_ms = int((time.monotonic() - query_started_at) * 1000)
                        ttfb_ms = (
                            int((first_assistant_at - query_started_at) * 1000)
                            if first_assistant_at is not None
                            else None
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

                        completed_at = datetime.now(UTC).isoformat()

                        await self.send_task_update(
                            task_id,
                            {
                                "type": "research_result",
                                "timestamp": completed_at,
                                "groupId": self._group_id,
                                "taskId": self._task_id,
                                "topic": result.get("topic", self._subtopic),
                                "summary": result.get("summary", answer),
                                "sources": result.get("sources", []),
                            },
                        )

                        await self.send_task_update(
                            task_id,
                            {
                                "type": "task_update",
                                "timestamp": completed_at,
                                "groupId": self._group_id,
                                "taskId": self._task_id,
                                "status": "completed",
                            },
                        )

                        await self.send_task_update(
                            task_id,
                            {
                                "type": "agent_event",
                                "timestamp": completed_at,
                                "agent": self.name,
                                "agentType": "BaseAgent",
                                "event": "worker_completed",
                                "groupId": self._group_id,
                                "detail": f'worker_completed("{self._subtopic}")',
                            },
                        )

                        metrics_payload: dict = {
                            "type": "agent_metrics",
                            "timestamp": completed_at,
                            "groupId": self._group_id,
                            "agent": self.name,
                            "taskId": self._task_id,
                            "durationMs": duration_ms,
                        }
                        if input_tokens is not None:
                            metrics_payload["inputTokens"] = input_tokens
                        if output_tokens is not None:
                            metrics_payload["outputTokens"] = output_tokens
                        if ttfb_ms is not None:
                            metrics_payload["ttfbMs"] = ttfb_ms
                        await self.send_task_update(task_id, metrics_payload)

                        await self.send_task_response(task_id, result)

                    except Exception as e:
                        logger.error(f"Worker '{self.name}': error: {e}")
                        error_at = datetime.now(UTC).isoformat()
                        await self.send_task_update(
                            task_id,
                            {
                                "type": "task_update",
                                "timestamp": error_at,
                                "groupId": self._group_id,
                                "taskId": self._task_id,
                                "status": "error",
                                "detail": str(e),
                            },
                        )
                        await self.send_task_update(
                            task_id,
                            {
                                "type": "agent_event",
                                "timestamp": error_at,
                                "agent": self.name,
                                "agentType": "BaseAgent",
                                "event": "worker_error",
                                "groupId": self._group_id,
                                "detail": f'worker_error("{self._subtopic}", "{e}")',
                            },
                        )
                        await self.send_task_response(task_id, {"error": str(e)}, status=TaskStatus.ERROR)

        except Exception as e:
            logger.error(f"Worker '{self.name}': failed to start Claude SDK: {e}")
