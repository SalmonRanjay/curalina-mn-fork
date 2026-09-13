# Contracts v1 contributing

Contract changes are additive-only for minor versions. Removing a field,
changing a unit, changing a status meaning, or changing a field's semantic
requires a new major version and sign-off from every consuming service.

Services own fixtures for their own endpoints during A1. The contracts
steward owns cross-service consistency: shared error shape, ID conventions,
version fields, and duplicate/conflicting names.

When an endpoint is shared across services (per `03_data_contracts.md`'s HTTP
surface table — e.g. `POST /v1/assets`, owned by every image service), the
concept's shape belongs in this folder as a JSON Schema during A1, not as a
service-local DTO only. A service-local schema for a shared concept is how
two services silently drift on the same field (see: rooms' A1 `AssetResponse`
diverging from the shared `asset.schema.json` on `provenance` type and an
exposed `storage_key`). A concept used by exactly one service may stay
local.

Breaking-change disagreements are escalated to `tech-lead` for an ADR.
