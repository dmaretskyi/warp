import { writeFileSync } from 'fs';
import * as pb from 'protobufjs'
import { codegenSchema } from './codegen';

const root = new pb.Root();

root.loadSync('src/example/proto/task_list.proto');

const content = codegenSchema(root);

writeFileSync('src/example/gen/schema.ts', content);