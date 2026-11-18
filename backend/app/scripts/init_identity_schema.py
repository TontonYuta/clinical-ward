"""Explicitly initialize the separate identity database schema.

Run with: python -m app.scripts.init_identity_schema
This command creates schema only; it never provisions accounts or credentials.
"""
import asyncio

from app.identity_database import get_identity_session_factory
from app.models.identity import IdentityBase


async def initialize() -> None:
    from app.identity_database import IDENTITY_DATABASE_URL, validate_identity_database_url
    if not IDENTITY_DATABASE_URL:
        raise RuntimeError(
            "Set IDENTITY_DATABASE_URL to a dedicated identity database before initialization. "
            "It must not be the clinical DATABASE_URL."
        )
    validate_identity_database_url(IDENTITY_DATABASE_URL)
    engine, _ = get_identity_session_factory()
    try:
        async with engine.begin() as connection:
            await connection.run_sync(IdentityBase.metadata.create_all)
        print("Identity schema initialized. No staff accounts or secrets were created.")
    finally:
        await engine.dispose()


def main() -> None:
    asyncio.run(initialize())


if __name__ == "__main__":
    main()
