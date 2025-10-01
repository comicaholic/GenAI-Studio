from pathlib import Path
import os

def ensure_dir(p: str|Path):
    Path(p).mkdir(parents=True, exist_ok=True)

def list_files(p: str|Path):
    p = Path(p)
    return [str(x) for x in p.glob("*") if x.is_file()]
