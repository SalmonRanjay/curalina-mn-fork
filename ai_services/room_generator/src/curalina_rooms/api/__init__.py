"""Room-generation HTTP transport package.

Typed `/v1` DTOs (`schemas.py`), the shared error vocabulary (`errors.py`),
JSON fixtures (`fixtures/`), the contract service (`service.py`, with both
an in-memory A1 fake and an A3 `SQLiteRoomStore`-backed durable path), the
durable store itself (`sqlite_store.py`), and the FastAPI ASGI app
(`app.py`). Worker leasing/completion lives in `curalina_rooms.workers`.
"""

from curalina_rooms.api.app import create_app
from curalina_rooms.api.errors import ContractError
from curalina_rooms.api.service import ContractResult, RoomsContractService

__all__ = ["ContractError", "ContractResult", "RoomsContractService", "create_app"]
