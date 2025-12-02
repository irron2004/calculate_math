diff --git a/app/config.py b/app/config.py
index c0d6a05..fcb1062 100644
--- a/app/config.py
+++ b/app/config.py
@@ -3,18 +3,32 @@ from __future__ import annotations
 import os
 from dataclasses import dataclass
 from functools import lru_cache
-from pathlib import Path
+from pathlib import Path
 from typing import List, Optional
 
 
-SERVICE_ROOT = Path(__file__).resolve().parent
-REPO_ROOT = SERVICE_ROOT.parent
-DEFAULT_DATA_PATH = (SERVICE_ROOT / "data" / "problems.json").resolve()
-DEFAULT_DB_PATH = (SERVICE_ROOT / "data" / "attempts.db").resolve()
-DEFAULT_CONCEPT_PATH = (SERVICE_ROOT / "data" / "concepts.json").resolve()
-DEFAULT_TEMPLATE_PATH = (SERVICE_ROOT / "data" / "templates.json").resolve()
-DEFAULT_DAG_PATH = (SERVICE_ROOT / "data" / "dag.json").resolve()
-DEFAULT_PROGRESS_PATH = (SERVICE_ROOT / "data" / "dag_progress.json").resolve()
+SERVICE_ROOT = Path(__file__).resolve().parent
+REPO_ROOT = SERVICE_ROOT.parent
+DATA_DIR = (SERVICE_ROOT / "data").resolve()
+LEGACY_DATA_DIR = (DATA_DIR / ".old").resolve()
+
+
+def _default_data_file(filename: str) -> Path:
+    primary = (DATA_DIR / filename).resolve()
+    legacy = (LEGACY_DATA_DIR / filename).resolve()
+    if primary.exists():
+        return primary
+    if legacy.exists():
+        return legacy
+    return primary
+
+
+DEFAULT_DATA_PATH = _default_data_file("problems.json")
+DEFAULT_DB_PATH = (DATA_DIR / "attempts.db").resolve()
+DEFAULT_CONCEPT_PATH = _default_data_file("concepts.json")
+DEFAULT_TEMPLATE_PATH = _default_data_file("templates.json")
+DEFAULT_DAG_PATH = _default_data_file("dag.json")
+DEFAULT_PROGRESS_PATH = _default_data_file("dag_progress.json")
 
 
 def _load_env_file() -> None:
