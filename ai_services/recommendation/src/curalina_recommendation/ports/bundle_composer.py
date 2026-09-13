"""`BundleComposer` port.

Future home of workflow step 5, "Bundle composition and substitutions with
full revalidation on every change," from
`agentic_flow/recommendation_workflow.md`'s A2 sequence. This step depends
on R03's go/no-go record (a legitimate outcome is "no-go on real furniture
data, logic-only on synthetic fixtures") *and* on `curalina_design_rules`,
which is separately ready (A0-A3 complete). R03 has not been run, so no
real implementation of this port exists yet — only
`adapters.fake_bundle_composer.FakeBundleComposer`, which performs no
spatial reasoning whatsoever.

Real implementation shape, once R03 clears
------------------------------------------
The real adapter will be the one piece of this service that imports
`curalina_design_rules` (the shared package every consumer pins an exact
`rules_version` for — see
`ai_services/design_rules/src/curalina_design_rules/api.py`). Concretely,
on every `compose` and every `substitute` call it will:

1. Call `curalina_design_rules.api.pinned_rules_version()` once at
   bootstrap and record it on the resulting `Bundle.rules_version` — never
   re-resolve it mid-request, so a mid-deployment rules change cannot
   silently change behaviour for an in-flight call.
2. Map this service's own `domain.Product`/`domain.Profile`/
   `domain.BundleLineItem` records into
   `curalina_design_rules.types.Placement` and
   `curalina_design_rules.types.RoomGeometry` — a translation that does
   not exist yet and is itself part of the blocked real logic, not
   something this port or its fake can approximate.
3. Call `curalina_design_rules.api.evaluate_spatial_layout(placements,
   room, rules)` to get a `RuleResult` (collisions, walkway clearance,
   `CMR_VALIDATION`), and translate its `violations` into this service's
   own `Bundle.violations`/`Bundle.feasible`.
4. Re-run step 3 on *every* substitution, not only on first composition
   ("full revalidation on every change") — a substitution that satisfies
   category/budget constraints but breaks a previously valid layout must
   surface as `feasible=False` with the specific violation, never as a
   silently accepted swap.

None of steps 1-4 are implemented by `FakeBundleComposer`; it never
imports `curalina_design_rules`.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from curalina_recommendation.domain.bundle import Bundle
from curalina_recommendation.domain.product import Product
from curalina_recommendation.domain.profile import Profile


class BundleComposer(Protocol):
    """Composes and revises shoppable/synthetic-fixture bundles."""

    def compose(
        self,
        *,
        products: Sequence[Product],
        profile: Profile,
        catalogue_snapshot_id: str,
        rules_version: str,
    ) -> Bundle:
        """Compose a first-revision `Bundle` for `profile` from `products`.

        Real implementation performs full spatial/rule revalidation via
        `curalina_design_rules` (see module docstring); blocked on R03.
        """
        ...

    def substitute(
        self,
        *,
        bundle: Bundle,
        replace_product_id: str,
        candidate: Product,
    ) -> Bundle:
        """Produce a new bundle revision replacing one product, preserving
        the original revision (per `03_data_contracts.md`: "New candidate
        revision, preserving original").

        Real implementation revalidates the *entire* layout after the
        swap, not just the changed line — a substitution that breaks a
        previously valid layout must come back `feasible=False`. Blocked
        on R03; `FakeBundleComposer.substitute` performs no such
        revalidation and must never be mistaken for this behaviour.
        """
        ...
