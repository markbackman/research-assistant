"""Observer that tracks whether the bot is currently speaking.

Used to defer announcements of background research results until the bot
finishes its current utterance, avoiding awkward interruptions.
"""

import asyncio

from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    InterruptionFrame,
)
from pipecat.observers.base_observer import BaseObserver, FramePushed


class SpeakingStateObserver(BaseObserver):
    """Tracks bot speaking state and lets callers wait for the next idle moment."""

    def __init__(self):
        super().__init__()
        self._is_bot_speaking = False
        self._was_interrupted = False
        self._waiters: list[asyncio.Event] = []

    @property
    def is_bot_speaking(self) -> bool:
        return self._is_bot_speaking

    async def wait_until_bot_stops(self) -> None:
        """Return immediately if the bot is idle; otherwise suspend until the bot
        completes a clean (uninterrupted) utterance. Interrupted stops are skipped
        so deferred announcements piggyback on the next natural idle moment rather
        than getting buried by the user's interruption flow. Exactly one queued
        waiter is released per clean transition."""
        if not self._is_bot_speaking:
            return
        ev = asyncio.Event()
        self._waiters.append(ev)
        await ev.wait()

    async def on_push_frame(self, data: FramePushed):
        frame = data.frame
        if isinstance(frame, BotStartedSpeakingFrame):
            self._is_bot_speaking = True
            self._was_interrupted = False
        elif isinstance(frame, InterruptionFrame) and self._is_bot_speaking:
            self._was_interrupted = True
        elif isinstance(frame, BotStoppedSpeakingFrame) and self._is_bot_speaking:
            self._is_bot_speaking = False
            if self._was_interrupted:
                return
            if self._waiters:
                self._waiters.pop(0).set()
