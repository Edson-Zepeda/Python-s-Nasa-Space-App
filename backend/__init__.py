"""
Compatibility wrapper so imports like ``import backend`` (and submodules such
as ``backend.app.main``) continue to work even though the real package lives
under ``cronoweath.backend``.
"""
import sys
from importlib import import_module

_backend_pkg = import_module("cronoweath.backend")

# Re-export public attributes at the package level so `import backend` works.
__all__ = [name for name in dir(_backend_pkg) if not name.startswith("_")]
for name in __all__:
    globals()[name] = getattr(_backend_pkg, name)

# Populate common submodules so `import backend.app.main` (and similar) resolve.
for submodule in ("app", "app.main"):
    full_name = f"cronoweath.backend.{submodule}"
    proxied = import_module(full_name)
    sys.modules[f"backend.{submodule}"] = proxied
