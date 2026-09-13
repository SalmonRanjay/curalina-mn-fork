"""Golden-scenario fixtures for the `curalina_design_rules` A3 acceptance suite.

`12_design_rules_engine.md` calls out Design Manual §8 as a ready-made
acceptance suite: four fully worked living-room/dining-room/bedroom
compositions the client authored specifically so an engine could reproduce
them exactly. **That §8 text is not present anywhere in this repository** —
`Training_Doc_1_-_Design_Manual.pdf` is referenced throughout `agentic_flow/`
but was never checked in (only unrelated marketing PDFs exist under
`attached_assets/`). Fabricating four scenarios and labelling them "the
manual's golden scenarios" would violate the same "never invent a rulebook
value" rule this package holds every threshold to.

So these are **representative** scenarios built only from thresholds already
present in `rules/spatial_rules.yaml` (condo / mid / large, one per room
type this packet's spatial engine covers), used to exercise the A3 entry
point end-to-end. They are NOT a substitute for the real §8 acceptance
suite. Encoding the actual four examples is blocked until the source PDF (or
an equivalent extract) is supplied — track that alongside OQ-011 (no
furniture catalogue), which blocks it for the same reason: there is no
document to transcribe from.
"""

from dataclasses import dataclass
from decimal import Decimal

from curalina_design_rules.types import (
    HomeCategory,
    Money,
    Placement,
    Point,
    Product,
    ProductAttributes,
    ProductCategory,
    ProductInstance,
    RoomGeometry,
    RoomType,
)

_IN_TO_MM = 25.4


def _mm(inches: float) -> int:
    return round(inches * _IN_TO_MM)


@dataclass(frozen=True)
class GoldenScenario:
    scenario_id: str
    description: str
    room: RoomGeometry
    placements: tuple[Placement, ...]
    expect_passes_hard_spatial: bool


def _sofa(width_in: float = 84, depth_in: float = 34) -> Product:
    return Product(
        product_id="prod_sofa",
        name="Sofa",
        category=ProductCategory.SOFA,
        width_mm=_mm(width_in),
        depth_mm=_mm(depth_in),
        height_mm=_mm(30),
        price=Money(amount=Decimal("1800.00"), currency="CAD"),
        attributes=ProductAttributes(),
    )


def _table(width_in: float, depth_in: float, product_id: str = "prod_table") -> Product:
    return Product(
        product_id=product_id,
        name="Table",
        category=ProductCategory.TABLE,
        width_mm=_mm(width_in),
        depth_mm=_mm(depth_in),
        height_mm=_mm(18),
        price=Money(amount=Decimal("900.00"), currency="CAD"),
        attributes=ProductAttributes(),
    )


def condo_living_room_conversation_circle() -> GoldenScenario:
    """A condo living room: sofa + coffee table, well within the 32" walkway
    minimum (9.1) and the OM sofa-to-table spacing band (9.2.1)."""
    room = RoomGeometry(
        room_id="golden_condo_living",
        room_type=RoomType.LIVING_ROOM,
        home_category=HomeCategory.CONDO,
        boundary=(
            Point(0, 0),
            Point(_mm(160), 0),
            Point(_mm(160), _mm(120)),
            Point(0, _mm(120)),
        ),
    )
    sofa = Placement(
        instance=ProductInstance(instance_id="inst_sofa", product=_sofa()),
        x_mm=_mm(10),
        y_mm=_mm(10),
        rotation_deg=0,
    )
    table = Placement(
        instance=ProductInstance(instance_id="inst_table", product=_table(48, 24)),
        x_mm=_mm(10),
        y_mm=_mm(10 + 34 + 15),  # OM sofa-to-table spacing: 15-16in
        rotation_deg=0,
    )
    return GoldenScenario(
        scenario_id="condo_living_room_conversation_circle",
        description=(
            "Condo living room, sofa + coffee table at OM sofa-to-table "
            "spacing, plenty of clearance to the far wall."
        ),
        room=room,
        placements=(sofa, table),
        expect_passes_hard_spatial=True,
    )


def mid_dining_room_service_perimeter() -> GoldenScenario:
    """A mid-size dining room: table + credenza at exactly the 48" buffer
    (9.3.1) and the 0.75x credenza-to-table proportion (9.3.2)."""
    room = RoomGeometry(
        room_id="golden_mid_dining",
        room_type=RoomType.DINING_ROOM,
        home_category=HomeCategory.MID,
        boundary=(
            Point(0, 0),
            Point(_mm(200), 0),
            Point(_mm(200), _mm(160)),
            Point(0, _mm(160)),
        ),
    )
    table = Placement(
        instance=ProductInstance(instance_id="inst_table", product=_table(84, 42)),
        x_mm=_mm(20),
        y_mm=_mm(20),
        rotation_deg=0,
    )
    # Credenza placed 48in beyond the table's far edge, per DR_CREDENZA_BUFFER.
    credenza = Placement(
        instance=ProductInstance(
            instance_id="inst_credenza",
            product=_table(63, 18, product_id="prod_credenza"),  # 0.75 x 84in table
        ),
        x_mm=_mm(20),
        y_mm=_mm(20 + 42 + 48),
        rotation_deg=0,
    )
    return GoldenScenario(
        scenario_id="mid_dining_room_service_perimeter",
        description=(
            "Mid-size dining room, table + credenza at exactly the required "
            "48in buffer and 0.75x length proportion."
        ),
        room=room,
        placements=(table, credenza),
        expect_passes_hard_spatial=True,
    )


def large_living_room_floating_anchor_violation() -> GoldenScenario:
    """A large living room over the 16ft floating-anchor width threshold
    (9.2.2.3), with the sofa placed flush against the wall — this must fail
    hard spatial validation."""
    room = RoomGeometry(
        room_id="golden_large_living",
        room_type=RoomType.LIVING_ROOM,
        home_category=HomeCategory.LARGE,
        boundary=(
            Point(0, 0),
            Point(_mm(17 * 12), 0),
            Point(_mm(17 * 12), _mm(220)),
            Point(0, _mm(220)),
        ),
    )
    sofa = Placement(
        instance=ProductInstance(instance_id="inst_sofa", product=_sofa()),
        x_mm=_mm(10),
        y_mm=0,  # against the wall -- violates LR_FLOATING_ANCHOR
        rotation_deg=0,
    )
    return GoldenScenario(
        scenario_id="large_living_room_floating_anchor_violation",
        description=(
            "Large living room over the 16ft width threshold with the sofa "
            "flush against the wall; LR_FLOATING_ANCHOR must fire."
        ),
        room=room,
        placements=(sofa,),
        expect_passes_hard_spatial=False,
    )


def condo_bedroom_pinched_ensuite_path() -> GoldenScenario:
    """A condo bedroom where a wardrobe placement pinches the corridor to the
    ensuite door below the 42" minimum (9.4.4) -- collision-free but still a
    hard spatial failure once BR_ENSUITE_PATH is evaluated by the consumer."""
    room = RoomGeometry(
        room_id="golden_condo_bedroom",
        room_type=RoomType.BEDROOM,
        home_category=HomeCategory.CONDO,
        boundary=(
            Point(0, 0),
            Point(_mm(140), 0),
            Point(_mm(140), _mm(110)),
            Point(0, _mm(110)),
        ),
    )
    obstruction = Placement(
        instance=ProductInstance(
            instance_id="inst_wardrobe",
            product=_table(4, 100, product_id="prod_wardrobe"),
        ),
        x_mm=_mm(70),
        y_mm=0,
        rotation_deg=0,
    )
    return GoldenScenario(
        scenario_id="condo_bedroom_pinched_ensuite_path",
        description=(
            "Condo bedroom with a full-depth obstruction pinching the "
            "bed-to-ensuite corridor; not a collision, but a reachability "
            "failure a consumer must check with spatial.check_br_ensuite_path."
        ),
        room=room,
        placements=(obstruction,),
        expect_passes_hard_spatial=True,  # no collision/walkway/CMR issue at the
        # `evaluate_spatial_layout` level; the reachability failure is a
        # separate named-rule check consumers run with explicit bed/door points.
    )


ALL_SCENARIOS: tuple[GoldenScenario, ...] = (
    condo_living_room_conversation_circle(),
    mid_dining_room_service_perimeter(),
    large_living_room_floating_anchor_violation(),
    condo_bedroom_pinched_ensuite_path(),
)
