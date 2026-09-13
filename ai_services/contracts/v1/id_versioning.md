# ID and Versioning Conventions

- HTTP paths use `/v1`.
- Payloads include `schema_version` with value `1.0`.
- Unsupported major versions must be rejected with `422`.
- Snapshot IDs use the `snap_` prefix.
- Revision IDs use the `rev_` prefix.
- Asset IDs use the `asset_` prefix.
- Job IDs use the `job_` prefix.
- Candidate IDs use the `cand_` prefix.
- Content hashes use lowercase SHA-256 hex prefixed with `sha256:`.
