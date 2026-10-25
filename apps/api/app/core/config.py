from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://avenor:avenor@localhost:5432/avenor"
    app_origin: str = "http://localhost:3000"
    cookie_secure: bool = False
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    model_config = SettingsConfigDict(env_file="../../.env", extra="ignore")


settings = Settings()
