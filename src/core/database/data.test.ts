import { DataArray, DataObject, DataRef } from './data'
import { Contact, schema } from '../../example/gen/warp-example-task_list'
import { v4 } from 'uuid';
import { expect } from 'expect';
import { Database } from './database';

describe.only('database/data', () => {
  it('basic props', () => {
    const task = new DataObject(schema.root.lookupType('warp.example.task_list.Task'), v4());
    expect(task.get('title')).toBe('');

    task.set('title', 'Milk');
    expect(task.get('title')).toBe('Milk');

    task.set('title', 'Eggs');
    expect(task.get('title')).toBe('Eggs');

    task.set('count', 2);
    expect(task.get('count')).toBe(2);

    task.set('completed', false);
    expect(task.get('completed')).toBe(false);
  })

  describe('ref', () => {
    it('with existing object', () => {
      const person = new DataObject(schema.root.lookupType('warp.example.task_list.Person'), v4());
      person.set('name', 'John');

      const contact = new DataObject(schema.root.lookupType('warp.example.task_list.Contact'), v4());
      contact.set('email', 'john@example.com');

      person.set('contact', new DataRef(contact.id).fill(contact));
      contact.setParent(new DataRef(person.id).fill(person));

      expect(person.get('contact')).toBeInstanceOf(DataRef);
      expect((person.get('contact') as DataRef).getObject()).toStrictEqual(contact);
      expect(contact.getParent()?.getObject()).toStrictEqual(person);
    })

    it('fill by importing to database', () => {
      const database = new Database(schema);

      const person = new DataObject(schema.root.lookupType('warp.example.task_list.Person'), v4());
      person.set('name', 'John');
      
      const contact = new DataObject(schema.root.lookupType('warp.example.task_list.Contact'), v4());
      contact.set('email', 'john@example.com');

      person.set('contact', new DataRef(contact.id));
      contact.setParent(new DataRef(person.id));

      database.importV2(person);
      database.importV2(contact);

      expect(person.get('contact')).toBeInstanceOf(DataRef);
      expect((person.get('contact') as DataRef).getObject()).toStrictEqual(contact);
      expect(contact.getParent()?.getObject()).toStrictEqual(person);
    })

    it('import with arrays', () => {
      const database = new Database(schema);

      const taskList = new DataObject(schema.root.lookupType('warp.example.task_list.TaskList'), v4());
      
      const task1 = new DataObject(schema.root.lookupType('warp.example.task_list.Task'), v4());
      task1.set('title', 'Milk');

      task1.setParent(new DataRef(taskList.id));
      (taskList.get('tasks') as DataArray).items.push(new DataRef(task1.id));

      const task2 = new DataObject(schema.root.lookupType('warp.example.task_list.Task'), v4());
      task2.set('title', 'Eggs');
      task2.setParent(new DataRef(taskList.id));
      (taskList.get('tasks') as DataArray).items.push(new DataRef(task2.id));

      database.importV2(taskList);
      database.importV2(task1);
      database.importV2(task2);

      expect((taskList.get('tasks') as DataArray).items.length).toEqual(2);
      expect(((taskList.get('tasks') as DataArray).items[0] as DataRef).getObject()).toStrictEqual(task1);
      expect(((taskList.get('tasks') as DataArray).items[1] as DataRef).getObject()).toStrictEqual(task2);
    });
  })
})