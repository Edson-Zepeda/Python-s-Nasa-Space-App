"""
Compatibility wrapper so imports like "import backend" keep working when the code lives under cronoweath.backend.
"""
from importlib import import_module

_module = import_module("cronoweath.backend")

__all__ = [name for name in dir(_module) if not name.startswith("_")]
for name in __all__:
    globals()[name] = getattr(_module, name)
