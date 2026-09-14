"""R02 evaluation package: frozen fixtures and label-derivation code for
the ranking-baseline notebook (ADR-0006, ADR-0007, Amendment 1).

Nothing in this package is imported by `domain/`, `ports/`, or any
`adapters/*_encoder.py` module — ADR-0006 §D2's leakage firewall requires
the label-source columns (`Room Type`, `Design Style`, `Tags`) to be
structurally unreachable from ranking code, and this package is the one
place they are read, for label construction only.
"""

from __future__ import annotations
