
import json
import os
from typing import List, Dict, Optional
import uuid
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
PROJECTS_FILE = os.path.join(DATA_DIR, "projects.json")
TASKS_FILE = os.path.join(DATA_DIR, "tasks.json")

class Database:
    def __init__(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        self._ensure_file(PROJECTS_FILE)
        self._ensure_file(TASKS_FILE)

    def _ensure_file(self, filepath):
        if not os.path.exists(filepath):
            with open(filepath, 'w') as f:
                json.dump([], f)

    def _read_json(self, filepath) -> List[Dict]:
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            return []

    def _write_json(self, filepath, data: List[Dict]):
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)

    # Projects
    def get_projects(self) -> List[Dict]:
        return self._read_json(PROJECTS_FILE)

    def get_project(self, project_id: str) -> Optional[Dict]:
        projects = self.get_projects()
        return next((p for p in projects if p['id'] == project_id), None)

    def create_project(self, project_data: Dict) -> Dict:
        projects = self.get_projects()
        new_project = {
            "id": str(uuid.uuid4()),
            "created_at": datetime.now().isoformat(),
            **project_data
        }
        projects.append(new_project)
        self._write_json(PROJECTS_FILE, projects)
        return new_project

    # Tasks
    def get_tasks(self, project_id: str = None) -> List[Dict]:
        tasks = self._read_json(TASKS_FILE)
        if project_id:
            return [t for t in tasks if t['project_id'] == project_id]
        return tasks

    def create_task(self, task_data: Dict) -> Dict:
        tasks = self.get_tasks()
        new_task = {
            "id": str(uuid.uuid4()),
            "status": "Upcoming", # Default status
            "created_at": datetime.now().isoformat(),
            **task_data
        }
        tasks.append(new_task)
        self._write_json(TASKS_FILE, tasks)
        return new_task

    def update_task(self, task_id: str, updates: Dict) -> Optional[Dict]:
        tasks = self.get_tasks()
        for i, task in enumerate(tasks):
            if task['id'] == task_id:
                tasks[i] = {**task, **updates}
                self._write_json(TASKS_FILE, tasks)
                return tasks[i]
        return None
