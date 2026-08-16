from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()

# The test suite runs each test with its own asyncio event loop (pytest-asyncio's default,
# function-scoped loop). A pooled connection checked out under one loop can't be reused under
# a later test's loop ("attached to a different loop"), so tests get NullPool: every checkout
# opens a fresh DBAPI connection and closes it on checkin instead of pooling across requests.
_engine_kwargs = {"poolclass": NullPool} if settings.environment.lower() == "test" else {"pool_pre_ping": True}

engine = create_async_engine(settings.database_url, **_engine_kwargs)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
