"""Room-generation HTTP transport package.

A1 scope: typed `/v1` DTOs (`schemas.py`), the shared error vocabulary
(`errors.py`), JSON fixtures (`fixtures/`) and a fixture-backed fake
contract service (`service.py`). No ASGI app, rendering, or worker logic
lives here yet — that is A3.
"""

from curalina_rooms.api.errors import ContractError
from curalina_rooms.api.service import ContractResult, RoomsContractService

__all__ = ["ContractError", "ContractResult", "RoomsContractService"]
