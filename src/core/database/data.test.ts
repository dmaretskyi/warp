import { DataObject } from './data'
import { schema } from '../../example/gen/warp-example-task_list'
import { v4 } from 'uuid';
import { expect } from 'expect';

describe.only('database/data', () => {
  it('basic props', () => {
    const task = new DataObject(schema.root.lookupType('warp.example.task_list.Task'), v4());
    expect(task.get('title')).toBe(undefined);

    task.set('title', 'Milk');
    expect(task.get('title')).toBe('Milk');

    task.set('title', 'Eggs');
    expect(task.get('title')).toBe('Eggs');
  })
})