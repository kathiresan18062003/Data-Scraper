from sqlalchemy import create_engine
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


def init_db():
    global _db_initialized
    if _db_initialized:
        return
    try:
        import backend.app.models.job  # noqa: F401
        Base.metadata.create_all(bind=engine)
        _db_initialized = True
    except Exception as exc:
        import logging
        logging.getLogger("uvicorn.error").warning(f"init_db non-fatal warning: {exc}")


def get_db():
    if not _db_initialized:
        init_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
