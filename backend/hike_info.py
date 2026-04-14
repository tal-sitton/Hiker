from pydantic import BaseModel, field_validator

MAXIMUM_LENGTH = 100  # Maximum length in kilometers


class HikeInfo(BaseModel):
    name: str
    coords: tuple[float, float]  # [latitude, longitude]
    length: float
    source: str
    difficulty: str
    tags: list[str]

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
