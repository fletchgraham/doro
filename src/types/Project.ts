// Longer-term planning lives in projects, each holding an ordered list of
// tasks. Unlike the day's tasks (which are thrown away each morning), these
// persist until they're finished or deleted.
export interface Project {
  id: string;
  name: string;
  order: number;
  collapsed: boolean;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  text: string;
  notes: string;
  done: boolean;
  order: number;
  // Agile-style story points; unpointed tasks count for nothing in
  // the project's progress
  points?: number;
}

export interface ProjectsState {
  projects: Project[];
  tasks: ProjectTask[];
}
