"""Research coordinator that orchestrates parallel research workers."""

from datetime import UTC, datetime

from loguru import logger
from pipecat_subagents.agents import BaseAgent, task
from pipecat_subagents.agents.task_context import TaskStatus
from pipecat_subagents.bus import AgentBus
from pipecat_subagents.bus.messages import (
    BusTaskRequestMessage,
    BusTaskResponseMessage,
    BusTaskUpdateMessage,
)

from research_worker import ResearchWorker


class ResearchCoordinator(BaseAgent):
    """Coordinates parallel research workers using task groups."""

    def __init__(self, name: str, *, bus: AgentBus):
        super().__init__(name, bus=bus)
        # worker_name → (app_group_id, app_task_id, parent_framework_task_id, requester)
        self._worker_info: dict[str, tuple[str, str, str, str]] = {}

    async def _send_update(self, task_id: str, requester: str, data: dict) -> None:
        """Send a task update using explicit task context (safe for concurrent tasks)."""
        await self.send_message(
            BusTaskUpdateMessage(
                source=self.name,
                target=requester,
                task_id=task_id,
                update=data,
            )
        )

    async def _send_response(self, task_id: str, requester: str, response: dict) -> None:
        """Send a task response using explicit task context (safe for concurrent tasks)."""
        await self.send_message(
            BusTaskResponseMessage(
                source=self.name,
                target=requester,
                task_id=task_id,
                response=response,
                status=TaskStatus.COMPLETED,
            )
        )

    async def on_task_response(self, message: BusTaskResponseMessage) -> None:
        """Called per-worker when each worker sends send_task_response().

        Fires before group completion tracking, so we can emit individual
        task completion events immediately as each worker finishes.
        """
        info = self._worker_info.get(message.source)
        if not info:
            return
        group_id, app_task_id, parent_task_id, requester = info
        status = (
            "error"
            if message.status in (TaskStatus.ERROR, TaskStatus.FAILED)
            else "completed"
        )
        await self._send_update(
            parent_task_id,
            requester,
            {
                "type": "task_update",
                "timestamp": datetime.now(UTC).isoformat(),
                "groupId": group_id,
                "taskId": app_task_id,
                "status": status,
            },
        )

    @task(parallel=True)
    async def on_task_request(self, message: BusTaskRequestMessage) -> None:
        # Capture task context from the message for concurrent safety.
        # We avoid self.send_task_update/send_task_response because they
        # rely on self._task_id which gets clobbered by concurrent requests.
        task_id = message.task_id
        requester = message.source

        query = message.payload["query"]
        subtopics = message.payload["subtopics"]
        group_id = message.payload["group_id"]
        depth = message.payload.get("depth", "standard")

        logger.info(
            f"Coordinator '{self.name}': received research request for '{query}' "
            f"with {len(subtopics)} subtopics"
        )

        worker_names = []
        for i, subtopic in enumerate(subtopics):
            worker_name = f"worker_{group_id[:8]}_{i}"
            app_task_id = f"{group_id[:8]}_{i}"
            self._worker_info[worker_name] = (
                group_id, app_task_id, task_id, requester,
            )
            worker = ResearchWorker(
                worker_name,
                bus=self.bus,
                subtopic=subtopic,
                query=query,
                group_id=group_id,
                worker_index=i,
                depth=depth,
            )
            await self.add_agent(worker)
            worker_names.append(worker_name)

        now = datetime.now(UTC).isoformat()

        for i, name in enumerate(worker_names):
            await self._send_update(
                task_id,
                requester,
                {
                    "type": "task_update",
                    "timestamp": now,
                    "groupId": group_id,
                    "taskId": f"{group_id[:8]}_{i}",
                    "status": "running",
                },
            )

        await self._send_update(
            task_id,
            requester,
            {
                "type": "agent_event",
                "timestamp": now,
                "agent": self.name,
                "agentType": "BaseAgent",
                "event": "task_group_started",
                "groupId": group_id,
                "detail": f"task_group({len(worker_names)})",
            },
        )

        async with self.task_group(
            *worker_names,
            payload={"query": query, "group_id": group_id},
            timeout=100,
            cancel_on_error=False,
        ) as tg:
            async for event in tg:
                if event.data:
                    await self._send_update(task_id, requester, event.data)

        await self._send_response(task_id, requester, tg.responses)
