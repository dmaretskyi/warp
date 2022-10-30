import { DataArray, DataObject, DataRef } from './data'
import { Contact, schema } from '../../example/gen/schema'
import { v4 } from 'uuid';
import { expect } from 'expect';
import { Database } from './database';
import { snapshotToJson } from './utils';

describe('database/data', () => {
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

      database.import(person);
      database.import(contact);

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

      database.import(taskList);
      database.import(task1);
      database.import(task2);

      expect((taskList.get('tasks') as DataArray).items.length).toEqual(2);
      expect(((taskList.get('tasks') as DataArray).items[0] as DataRef).getObject()).toStrictEqual(task1);
      expect(task1.getParent()?.getObject()).toStrictEqual(taskList);
      expect(((taskList.get('tasks') as DataArray).items[1] as DataRef).getObject()).toStrictEqual(task2);
      expect(task2.getParent()?.getObject()).toStrictEqual(taskList);
    });
  });

  describe('serialization', () => {
    it('single object', () => {
      const original = new DataObject(schema.root.lookupType('warp.example.task_list.Task'), v4());
      original.set('title', 'Eggs');
      original.set('count', 2);
      original.set('completed', false);

      const clone = new DataObject(schema.root.lookupType('warp.example.task_list.Task'), original.id);
      clone.deserialize(original.serialize());
      
      expect(original.get('title')).toBe('Eggs');
      expect(original.get('count')).toBe(2);
      expect(original.get('completed')).toBe(false);
    })

    it('two objects with ref', () => {
      const originalPerson = new DataObject(schema.root.lookupType('warp.example.task_list.Person'), v4());
      originalPerson.set('name', 'John');
      
      const originalContact = new DataObject(schema.root.lookupType('warp.example.task_list.Contact'), v4());
      originalContact.set('email', 'john@example.com');
      
      originalPerson.set('contact', new DataRef(originalContact.id));
      originalContact.setParent(new DataRef(originalPerson.id));

      const database = new Database(schema);
      
      const person = new DataObject(schema.root.lookupType('warp.example.task_list.Person'), originalPerson.id);

      person.deserialize(originalPerson.serialize());
      database.import(person);

      const contact = new DataObject(schema.root.lookupType('warp.example.task_list.Contact'), originalContact.id);
      contact.deserialize(originalContact.serialize());
      database.import(contact);

      expect(person.get('contact')).toBeInstanceOf(DataRef);
      expect((person.get('contact') as DataRef).getObject()).toStrictEqual(contact);
      expect(contact.getParent()?.getObject()).toStrictEqual(person);
    })

    it('arrays', () => {
      const database = new Database(schema);

      const originalTaskList = new DataObject(schema.root.lookupType('warp.example.task_list.TaskList'), v4());
      
      const originalTask1 = new DataObject(schema.root.lookupType('warp.example.task_list.Task'), v4());
      originalTask1.set('title', 'Milk');

      originalTask1.setParent(new DataRef(originalTaskList.id));
      (originalTaskList.get('tasks') as DataArray).items.push(new DataRef(originalTask1.id));

      const originalTask2 = new DataObject(schema.root.lookupType('warp.example.task_list.Task'), v4());
      originalTask2.set('title', 'Eggs');
      originalTask2.setParent(new DataRef(originalTaskList.id));
      (originalTaskList.get('tasks') as DataArray).items.push(new DataRef(originalTask2.id));


      const taskList = new DataObject(schema.root.lookupType('warp.example.task_list.TaskList'), originalTaskList.id);
      taskList.deserialize(originalTaskList.serialize());
      database.import(taskList);

      const task1 = new DataObject(schema.root.lookupType('warp.example.task_list.Task'), originalTask1.id);
      task1.deserialize(originalTask1.serialize());
      database.import(task1);

      const task2 = new DataObject(schema.root.lookupType('warp.example.task_list.Task'), originalTask2.id);
      task2.deserialize(originalTask2.serialize());
      database.import(task2);

      expect((taskList.get('tasks') as DataArray).items.length).toEqual(2);
      expect(((taskList.get('tasks') as DataArray).items[0] as DataRef).getObject()).toStrictEqual(task1);
      expect(task1.getParent()?.getObject()).toStrictEqual(taskList);
      expect(((taskList.get('tasks') as DataArray).items[1] as DataRef).getObject()).toStrictEqual(task2);
      expect(task2.getParent()?.getObject()).toStrictEqual(taskList);
    })
  })

  describe('partial mutations', () => {
    it('basic fields with no races', () => {
      const client = new DataObject(schema.root.lookupType('warp.example.task_list.Task'), v4());
      client.markDirty()
      client.set('title', 'Eggs');

      const server = new DataObject(schema.root.lookupType('warp.example.task_list.Task'), client.id);

      server.deserializeMutation(client.serializeMutation());
      expect(server.get('title')).toBe('Eggs');
      
      server.commit()
      client.deserialize(server.serialize());
      expect(client.dirtyFields.size).toBe(0);

      client.set('count', 2);
      server.deserializeMutation(client.serializeMutation());
      expect(client.get('title')).toBe('Eggs');
      expect(client.get('count')).toBe(2);
    })

    it('local mutation are rebased on top of server state', () => {
      const client = new DataObject(schema.root.lookupType('warp.example.task_list.Task'), v4());
      client.markDirty()
      client.set('title', 'Eggs');

      const server = new DataObject(schema.root.lookupType('warp.example.task_list.Task'), client.id);

      server.deserializeMutation(client.serializeMutation());
      server.commit()
      expect(server.get('title')).toBe('Eggs');

      client.set('title', 'Eggs and milk');

      client.deserialize(server.serialize());
      expect(client.dirtyFields.size).toBe(1);
      expect(client.get('title')).toBe('Eggs and milk');
      
      server.deserializeMutation(client.serializeMutation());
      server.commit()
      client.deserialize(server.serialize());


      expect(client.get('title')).toBe('Eggs and milk');
      expect(server.get('title')).toBe('Eggs and milk');
      expect(client.dirtyFields.size).toBe(0);
    })
  })
})