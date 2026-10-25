from fastapi import FastAPI
from sqlalchemy import text

from app.db.session import engine

app = FastAPI(title="Avenor Analytics", version="0.1.0")


@app.get("/api/v1/health")
async def health() -> dict[str, str]:
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
    return {"status": "ok"}
