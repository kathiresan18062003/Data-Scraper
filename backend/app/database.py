import json
import logging

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool
from backend.app.config import DATABASE_URL, IS_VERCEL

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

if IS_VERCEL:
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        poolclass=NullPool
    )
else:
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


_db_initialized = False
logger = logging.getLogger(__name__)


def init_db():
    global _db_initialized
    if _db_initialized:
        return
    try:
        import backend.app.models.job  # noqa: F401
        Base.metadata.create_all(bind=engine)
        columns = {column["name"] for column in inspect(engine).get_columns("product_results")}
        if "field_evidence" not in columns:
            with engine.begin() as connection:
                connection.execute(text(
                    "ALTER TABLE product_results ADD COLUMN field_evidence TEXT NOT NULL DEFAULT '{}'"
                ))
        with engine.begin() as connection:
            for row in connection.execute(text("SELECT id, config FROM jobs")).all():
                try:
                    config = json.loads(row.config or "{}")
                except (TypeError, ValueError):
                    logger.warning("Skipped invalid job config while removing legacy browser-supplied Gemini credentials.")
                    continue
                if isinstance(config, dict) and config.pop("gemini_api_key", None) is not None:
                    connection.execute(
                        text("UPDATE jobs SET config = :config WHERE id = :job_id"),
                        {"config": json.dumps(config), "job_id": row.id},
                    )
        _db_initialized = True
    except Exception as exc:
        logger.warning(f"init_db non-fatal warning: {exc}")


def get_db():
    if not _db_initialized:
        init_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
