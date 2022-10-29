import { Task, TaskList } from "../gen/warp-example-task_list"
import { useObject } from "./common";

export type TaskListViewProps = {
  taskList: TaskList;
}

export const TaskListView = ({ taskList }: TaskListViewProps) => {
  useObject(taskList)

  const addTask = () => { 
    taskList.tasks.push(new Task({ title: 'New task' }));
  };

  const editTaskTitle = (task: Task, newTitle: string) => {
    task.title = newTitle;
  }

  return (
    <div style={{ flex: 1 }}>
      <button onClick={addTask}>
        Add Task
      </button>
      {taskList && <div>
        {taskList.tasks.map(task => (
          <div key={task.id}>
            <input type="checkbox" checked={task.completed} onChange={e => task.completed = e.target.checked} />
            <input type="text" value={task.title} onChange={e => editTaskTitle(task, e.currentTarget.value)} />
          </div>
        ))}  
      </div>}
    </div>
  )
}