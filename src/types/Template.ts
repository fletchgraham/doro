// A named list of subtasks, kept on the Templates page and applied by
// typing "/name" wherever a task or subtask is added. Steps are plain
// strings in the order they'll be added; they get ids only when they
// become real subtasks on a task.
export interface Template {
  id: string;
  name: string;
  steps: string[];
}

export interface TemplatesState {
  templates: Template[];
}
