from slugify import slugify

from app.schemas.platform import RESERVED_SLUGS


def slug_from_name(name: str) -> str:
    slug = slugify(name)[:63].strip("-")
    if len(slug) < 3:
        slug = f"{slug}-academy"[:63].strip("-")
    return slug


def is_reserved(slug: str) -> bool:
    return slug in RESERVED_SLUGS
