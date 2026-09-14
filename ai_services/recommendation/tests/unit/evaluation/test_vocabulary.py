"""§D4a: three-bucket label-token classification (canonical / out_of_axis /
unresolvable)."""

from __future__ import annotations

from curalina_recommendation.evaluation.vocabulary import Bucket, VocabularyMap


def _vocab() -> VocabularyMap:
    return VocabularyMap(
        canonical_styles=("Modern Farmhouse", "Organic Modern"),
        canonical_tags=("Warm Neutrals", "Earth & Stone"),
        canonical_rooms=("Dining room", "Living room"),
        material_family_tags=("Walnut",),
        tag_reference={},
        style_synonyms={"farmhouse": "Modern Farmhouse"},
        style_out_of_axis={"living room": "room_type_string_in_style_column"},
        tag_synonyms={"earthy & stone": "Earth & Stone"},
        tag_out_of_axis={"outdoor suitable": "functional_tag_no_atmosphere_equivalent"},
        room_synonyms={"living room": "Living room"},
    )


def test_exact_canonical_term_classifies_as_canonical() -> None:
    bucket, canon = _vocab().classify("Modern Farmhouse", "style")
    assert bucket is Bucket.CANONICAL
    assert canon == "Modern Farmhouse"


def test_authored_synonym_resolves_to_canonical() -> None:
    bucket, canon = _vocab().classify("Farmhouse", "style")
    assert bucket is Bucket.CANONICAL
    assert canon == "Modern Farmhouse"


def test_authored_out_of_axis_token_is_out_of_axis_not_unresolvable() -> None:
    bucket, canon = _vocab().classify("Outdoor Suitable", "tag")
    assert bucket is Bucket.OUT_OF_AXIS
    assert canon is None


def test_unknown_token_is_unresolvable_never_best_guessed() -> None:
    bucket, canon = _vocab().classify("Definitely Not A Real Style", "style")
    assert bucket is Bucket.UNRESOLVABLE
    assert canon is None


def test_canonical_key_ignores_case_whitespace_and_slash_spacing() -> None:
    bucket, canon = _vocab().classify("  modern   farmhouse  ", "style")
    assert bucket is Bucket.CANONICAL
    assert canon == "Modern Farmhouse"

    bucket2, canon2 = _vocab().classify("earth &  stone", "tag")
    assert bucket2 is Bucket.CANONICAL
    assert canon2 == "Earth & Stone"


def test_round_trip_to_dict_from_dict() -> None:
    vocab = _vocab()
    restored = VocabularyMap.from_dict(vocab.to_dict())
    assert restored == vocab
