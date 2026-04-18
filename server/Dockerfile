FROM dailyco/pipecat-base:latest

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy from the cache instead of linking since it's a mounted volume
ENV UV_LINK_MODE=copy

# Uncomment if you wish to print a summary of the features available in the base image
# ENV PCC_LOG_FEATURES_SUMMARY=true

# Install the project's dependencies using the lockfile and settings
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project --no-dev

# Copy the application code
COPY ./bot.py bot.py
COPY ./voice_agent.py voice_agent.py
COPY ./speaking_state.py speaking_state.py
COPY ./research_coordinator.py research_coordinator.py
COPY ./research_worker.py research_worker.py

# Claude Agent SDK rejects --dangerously-skip-permissions under root, which is
# what permission_mode="bypassPermissions" resolves to. Run as a non-root user
# with a writable HOME so the SDK can manage its config under ~/.claude.
RUN useradd --create-home --shell /bin/bash --uid 1000 appuser \
    && chown -R appuser:appuser .
USER appuser
ENV HOME=/home/appuser