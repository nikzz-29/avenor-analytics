import json
import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException

from app.core.body_limit import RequestSizeLimit
from app.db.session import engine
from app.modules import analytics, auth, imports, saved, workspaces

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("avenor")
app = FastAPI(title="Avenor Analytics", version="0.1.0")
app.add_middleware(RequestSizeLimit)
for router in (auth.router, workspaces.router, analytics.router, imports.router, saved.router):
    app.include_router(router, prefix="/api/v1")


@app.middleware("http")
async def request_context(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    request_id = str(uuid.uuid4())
    started = time.monotonic()
    if (
        request.headers.get("content-length", "").isdigit()
        and int(request.headers["content-length"]) > 11 * 1024 * 1024
    ):
        return JSONResponse(
            {"detail": "Request exceeds 11 MiB", "request_id": request_id}, status_code=413
        )
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    logger.info(
        json.dumps(
            {
                "request_id": request_id,
                "method": request.method,
                "status": response.status_code,
                "duration_ms": round((time.monotonic() - started) * 1000),
            }
        )
    )
    return response


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        {"field": ".".join(str(v) for v in error["loc"]), "message": error["msg"]}
        for error in exc.errors()
    ]
    return JSONResponse(
        {"detail": "Please check the submitted fields", "errors": errors}, status_code=422
    )


@app.get("/api/v1/health")
async def health() -> dict[str, str]:
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
    return {"status": "ok"}
