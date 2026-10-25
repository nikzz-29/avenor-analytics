from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class RequestSizeLimit:
    """Bound chunked uploads as well as requests carrying Content-Length."""

    def __init__(self, app: ASGIApp, max_bytes: int = 11 * 1024 * 1024) -> None:
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        consumed = 0

        async def bounded_receive() -> Message:
            nonlocal consumed
            message = await receive()
            if message["type"] == "http.request":
                consumed += len(message.get("body", b""))
                if consumed > self.max_bytes:
                    raise HTTPException(413, "Request exceeds 11 MiB")
            return message

        await self.app(scope, bounded_receive if scope["type"] == "http" else receive, send)
