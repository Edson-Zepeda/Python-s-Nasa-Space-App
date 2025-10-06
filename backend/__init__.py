"""
Compatibility layer so commands that import `backend.*` keep working even
though the real code lives under `cronoweath.backend`.
"""
from importlib import import_module

_module = import_module("cronoweath.backend")

__all__ = []
for _name in dir(_module):
    if _name.startswith("_"):
        continue
    globals()[_name] = getattr(_module, _name)
    __all__.append(_name)
