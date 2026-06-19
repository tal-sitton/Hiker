from typing import Any

from pydantic import BaseModel, field_validator

MAXIMUM_LENGTH = 100  # Maximum length in kilometers


class HikeInfo(BaseModel):
    name: str
    coords: tuple[float, float]  # [latitude, longitude]
    length: float
    source: str
    difficulty: str
    tags: list[str]

    def copy_from(self, other: 'HikeInfo'):
        self.name = other.name
        self.coords = other.coords
        self.length = other.length
        self.source = other.source
        self.difficulty = other.difficulty
        self.tags = other.tags

    @field_validator('length')
    @classmethod
    def validate_length(cls, value):
        if value > MAXIMUM_LENGTH:
            return value / 1000
        return value

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, value):
        return [value.strip() for value in value if value.strip()]
