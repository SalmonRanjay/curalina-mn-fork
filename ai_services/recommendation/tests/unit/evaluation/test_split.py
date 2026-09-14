"""§D5 step 6: mechanical dev/held-out split by `sha256(brief_id)`."""

from __future__ import annotations

import hashlib

from curalina_recommendation.evaluation.label_rules import Brief
from curalina_recommendation.evaluation.split import compute_split


def _brief(brief_id: str, stratum: str) -> Brief:
    return Brief(
        brief_id=brief_id,
        stratum=stratum,
        room_type="Dining room",
        categories=("Dining Chairs",),
    )


def _briefs_16() -> list[Brief]:
    stratum_a = [_brief(f"A{i}", "A") for i in range(1, 10)]  # 9
    stratum_b = [_brief(f"B{i}", "B") for i in range(1, 5)]  # 4
    stratum_c = [_brief(f"C{i}", "C") for i in range(1, 4)]  # 3
    return stratum_a + stratum_b + stratum_c


def test_split_is_deterministic_for_the_same_brief_ids() -> None:
    briefs = _briefs_16()

    split_1 = compute_split(briefs)
    split_2 = compute_split(list(reversed(briefs)))

    assert split_1.dev_brief_ids == split_2.dev_brief_ids
    assert split_1.held_out_brief_ids == split_2.held_out_brief_ids


def test_split_assignment_matches_digest_ordering_within_stratum() -> None:
    # ceil(9/3) = 3 held-out for stratum A: the three lowest-digest ids.
    stratum_a = [_brief(f"A{i}", "A") for i in range(1, 10)]
    ordered = sorted(
        stratum_a, key=lambda b: hashlib.sha256(b.brief_id.encode()).hexdigest()
    )
    expected_held_out = {b.brief_id for b in ordered[:3]}

    split = compute_split(stratum_a)

    assert set(split.held_out_brief_ids) == expected_held_out
    assert len(split.held_out_brief_ids) == 3
    assert len(split.dev_brief_ids) == 6


def test_split_proportions_match_adr_0006_16_brief_layout() -> None:
    briefs = _briefs_16()

    split = compute_split(briefs)

    # 3 of 9 (A), 2 of 4 (B), 1 of 3 (C) -> 6 held-out, 10 dev.
    assert len(split.held_out_brief_ids) == 6
    assert len(split.dev_brief_ids) == 10
    assert len(split.held_out_brief_ids) + len(split.dev_brief_ids) == len(briefs)


def test_every_stratum_is_represented_on_both_sides_of_the_split() -> None:
    briefs = _briefs_16()

    split = compute_split(briefs)

    by_id = {b.brief_id: b for b in briefs}
    dev_strata = {by_id[bid].stratum for bid in split.dev_brief_ids}
    held_out_strata = {by_id[bid].stratum for bid in split.held_out_brief_ids}

    assert dev_strata == {"A", "B", "C"}
    assert held_out_strata == {"A", "B", "C"}


def test_split_partitions_with_no_overlap_and_no_duplicates() -> None:
    briefs = _briefs_16()

    split = compute_split(briefs)

    dev_set = set(split.dev_brief_ids)
    held_out_set = set(split.held_out_brief_ids)

    assert dev_set.isdisjoint(held_out_set)
    assert len(dev_set) == len(split.dev_brief_ids)
    assert len(held_out_set) == len(split.held_out_brief_ids)


def test_split_on_empty_brief_list_returns_empty_split() -> None:
    split = compute_split([])

    assert split.dev_brief_ids == ()
    assert split.held_out_brief_ids == ()


def test_split_single_brief_stratum_goes_entirely_to_held_out() -> None:
    # ceil(1/3) = 1 -> the sole brief is held-out, dev is empty for that
    # stratum (a real, if unusual, boundary case of the mechanical rule).
    briefs = [_brief("Z1", "Z")]

    split = compute_split(briefs)

    assert split.held_out_brief_ids == ("Z1",)
    assert split.dev_brief_ids == ()
