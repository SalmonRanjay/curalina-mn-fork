"""Which pieces a room gets: Design Manual §4.2 "The Object Hierarchy" (p.96-97).

`ADR-0021` §D5 requires a room's categories to come from a Design Manual
room-composition rule. §4.2 sorts every room into three tiers:

- Tier 1, Foundation (the anchor):
  Living "Sofa, Large Sectional, or Statement Credenza"; Dining "Dining
  Table"; Bedroom "Bed / Headboard".
- Tier 2, Bridge (the connectors):
  Living "Accent Chairs, Coffee Tables, Area Rugs, Side Tables"; Dining
  "Dining Chairs"; Bedroom "Nightstands, Bench at Foot of Bed, Area Rug".
- Tier 3, Accent (the punctuation), of which the catalogue carries only:
  Living "Small Stools, or Ottomans"; Bedroom "Art".

Mapping the Manual's words onto catalogue `Product Type` values is this
module's interpretation and is listed in `ADR-0025` for client review:
"Statement Credenza" = `Sideboard` (used only when no sofa qualifies),
"Art" = `Wall Art`. Pieces the catalogue does not carry (area rugs, lamps,
cushions, throws, centrepieces) are reported as `not_in_catalogue`, never
substituted.

Quantities: nightstands are a matched pair (Manual §9.4.1, `BR_TWIN_NIGHTSTAND`
in `curalina_design_rules`). Dining chairs follow the seating answer; without
one, the chosen table's own `Seating: N` tag; without either, one chair and a
note saying so.
"""

from __future__ import annotations

from dataclasses import dataclass

FOUNDATION = "foundation"
BRIDGE = "bridge"
ACCENT = "accent"
MANUAL_SOURCE = "Design Manual §4.2 The Object Hierarchy, p.96-97"


@dataclass(frozen=True, slots=True)
class Slot:
    slot_id: str
    tier: str
    label: str
    categories: tuple[str, ...]  # catalogue categories, in preference order
    quantity_rule: str = "one"  # "one" | "pair" | "seating"
    fallback_categories: tuple[str, ...] = ()  # only if no primary category qualifies


@dataclass(frozen=True, slots=True)
class RoomPlan:
    room: str
    slots: tuple[Slot, ...]
    not_in_catalogue: tuple[str, ...]


ROOM_PLANS: dict[str, RoomPlan] = {
    "Living Room": RoomPlan(
        room="Living Room",
        slots=(
            Slot(
                "living_foundation",
                FOUNDATION,
                "Sofa or sectional",
                ("Sectional / Modular Sofa", "Sofa"),
                fallback_categories=("Sideboard",),
            ),
            Slot("living_accent_chair", BRIDGE, "Accent chair", ("Accent Chair",)),
            Slot("living_coffee_table", BRIDGE, "Coffee table", ("Coffee Table",)),
            Slot("living_side_table", BRIDGE, "Side table", ("Side Table",)),
            Slot("living_ottoman", ACCENT, "Ottoman", ("Ottoman",)),
        ),
        not_in_catalogue=(
            "Area rug",
            "Throw pillows",
            "Throws",
            "Table lamps",
            "Books",
            "Candles",
        ),
    ),
    "Dining Room": RoomPlan(
        room="Dining Room",
        slots=(
            Slot("dining_table", FOUNDATION, "Dining table", ("Dining Table",)),
            Slot(
                "dining_chairs",
                BRIDGE,
                "Dining chairs",
                ("Dining Chair",),
                quantity_rule="seating",
            ),
        ),
        not_in_catalogue=(
            "Centerpieces",
            "Sculptural bowls",
            "Candlesticks",
            "Table linens",
        ),
    ),
    "Bedroom": RoomPlan(
        room="Bedroom",
        slots=(
            Slot("bedroom_bed", FOUNDATION, "Bed", ("Bed",)),
            Slot(
                "bedroom_nightstands",
                BRIDGE,
                "Nightstands (matched pair)",
                ("Nightstand",),
                quantity_rule="pair",
            ),
            Slot("bedroom_bench", BRIDGE, "Bench at foot of bed", ("Bench",)),
            Slot("bedroom_art", ACCENT, "Art", ("Wall Art",)),
        ),
        not_in_catalogue=(
            "Area rug",
            "Decorative cushions",
            "Bed throws",
            "Lamps",
            "Dresser trays",
        ),
    ),
}
