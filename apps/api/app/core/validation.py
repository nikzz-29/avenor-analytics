"""Reusable validation at external text and numeric boundaries."""

from typing import Annotated

from pydantic import AfterValidator


def reject_nul(value: str) -> str:
    if "\x00" in value:
        raise ValueError("NUL characters are not supported")
    return value


CleanText = Annotated[str, AfterValidator(reject_nul)]
