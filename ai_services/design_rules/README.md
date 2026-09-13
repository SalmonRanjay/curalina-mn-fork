# curalina_design_rules

Pure Python design-rules library for Curalina.

This package is the only shared Python package allowed by the future-state
service architecture. It must remain stateless and side-effect free: no HTTP
API, no database access, no framework imports, and no filesystem reads from
domain code.

Phase A0 contains only the package scaffold. Rule contracts, YAML loaders,
and evaluators are added by later packets.

Phase A1 adds immutable contract types and synthetic fixtures for later rule
loaders and evaluators. The package still has no YAML loading, rule
evaluation, geometry engine, HTTP API, database access, model imports, or
notebook logic.

Phase A2 adds explicit YAML loaders for the style constitution, spatial rules,
and open-question register. These loaders compile source documents into frozen
contract objects and metadata only; they still do not evaluate rules or run
geometry/palette logic.
