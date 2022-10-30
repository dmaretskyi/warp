import { useState } from "react";
import { schema, Task, TaskList } from "../gen/schema";
import { useDatabase, useObject } from "./common";
import './App.css'

export const App = () => {
  const taskList = useDatabase(TaskList, { schema, url: 'ws://localhost:1122' })

  useObject(taskList)

  const addTask = (title: string) => {
    taskList?.tasks.push(new Task({ title }));
  };

  const editTaskTitle = (task: Task, newTitle: string) => {
    task.title = newTitle;
  }

  const [newTaskText, setNewTaskText] = useState('');

  return (
    <div className="App">
      <header>
        <h1 className="todoAppTitle">todos</h1>
      </header>
      <form
        className="todoAppForm"
        onSubmit={(e) => {
          e.preventDefault();
          addTask(newTaskText);
          setNewTaskText('');
        }}>
        <input className="todoInput" type="text" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} />
        <button className="todoAppAddButton">Add</button>
      </form>
      <div >
        <div>
          {taskList && taskList.tasks.map(task => (
            <div key={task.id} className="todoListItem">
              <label>
                <input type="checkbox" checked={task.completed} onChange={e => task.completed = e.target.checked} />
                <input type="text" value={task.title} onChange={e => editTaskTitle(task, e.currentTarget.value)} />
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

