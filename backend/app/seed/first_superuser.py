"""Seed the first platform super user. Run once against a fresh database:

    python -m app.seed.first_superuser --username admin --name "Platform Admin" --password <pw>

If --password is omitted, a random one is generated and printed once.
"""

import argparse
import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.superuser import SuperUser
from app.services.passwords import generate_temp_password


async def create_first_superuser(username: str, name: str, password: str | None) -> None:
    password = password or generate_temp_password()

    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(SuperUser).where(SuperUser.username == username))
        if existing.scalar_one_or_none() is not None:
            print(f"Super user '{username}' already exists; nothing to do.")
            return

        superuser = SuperUser(username=username, name=name, password_hash=hash_password(password))
        db.add(superuser)
        await db.commit()

    print(f"Created super user '{username}'.")
    print(f"Password: {password}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the first platform super user")
    parser.add_argument("--username", default="admin")
    parser.add_argument("--name", default="Platform Admin")
    parser.add_argument("--password", default=None)
    args = parser.parse_args()

    asyncio.run(create_first_superuser(args.username, args.name, args.password))


if __name__ == "__main__":
    main()
