from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum


class StyleCode(StrEnum):
    OM = "OM"
    MS = "MS"
    CL = "CL"


class RoomType(StrEnum):
    LIVING_ROOM = "living_room"
    DINING_ROOM = "dining_room"
    BEDROOM = "bedroom"


class HomeCategory(StrEnum):
    CONDO = "condo"
    MID = "mid"
    LARGE = "large"


class ProductCategory(StrEnum):
    SOFA = "sofa"
    CHAIR = "chair"
    TABLE = "table"
    BED = "bed"
    RUG = "rug"
    LIGHTING = "lighting"
    MEDIA = "media"
    STORAGE = "storage"
    ART = "art"
    DECOR = "decor"


@dataclass(frozen=True)
class Color:
    hex: str
    h_deg: int
    s_pct: int
    l_pct: int

    def __post_init__(self) -> None:
        _require_int("h_deg", self.h_deg)
        _require_int("s_pct", self.s_pct)
        _require_int("l_pct", self.l_pct)


@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: str

    def __post_init__(self) -> None:
        if not isinstance(self.amount, Decimal):
            raise TypeError("amount must be decimal.Decimal")
        if not self.currency:
            raise ValueError("currency is required")


def _require_int(field_name: str, value: int) -> None:
    if not isinstance(value, int) or isinstance(value, bool):
        raise TypeError(f"{field_name} must be an integer")
