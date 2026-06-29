# Backend route modules. These are split out of server.py to keep each domain
# self-contained. Routers in this package use a deferred import to avoid the
# circular-import trap: server.py imports them AT THE BOTTOM of its module
# after all shared symbols (db, helpers, models) have been defined, and each
# route function pulls what it needs via `_srv()` (which caches the resolved
# server module).
