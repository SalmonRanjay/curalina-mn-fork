"""`BundleService` — application-layer orchestration for `/v1/bundles` and
`/v1/bundles/{id}/substitutions`.

Pure pass-through to the injected `BundleComposer` port. Only
`adapters.FakeBundleComposer` exists today, performing no spatial
reasoning; the real composer (workflow step 5) is a drop-in replacement of
the same port once R03 clears and the `curalina_design_rules` wiring
described in `ports/bundle_composer.py` is built.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from curalina_recommendation.domain.bundle import Bundle
from curalina_recommendation.domain.product import Product
from curalina_recommendation.domain.profile import Profile
from curalina_recommendation.ports.bundle_composer import BundleComposer


@dataclass(frozen=True, slots=True)
class BundleService:
    composer: BundleComposer

    def compose(
        self,
        *,
        products: Sequence[Product],
        profile: Profile,
        catalogue_snapshot_id: str,
        rules_version: str,
    ) -> Bundle:
        return self.composer.compose(
            products=products,
            profile=profile,
            catalogue_snapshot_id=catalogue_snapshot_id,
            rules_version=rules_version,
        )

    def substitute(
        self, *, bundle: Bundle, replace_product_id: str, candidate: Product
    ) -> Bundle:
        return self.composer.substitute(
            bundle=bundle,
            replace_product_id=replace_product_id,
            candidate=candidate,
        )
