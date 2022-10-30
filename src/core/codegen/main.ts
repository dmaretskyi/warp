import { writeFileSync } from 'fs';
import * as pb from 'protobufjs'
import { codegenClass, codegenSchema, iterTypes } from './codegen';

const root = new pb.Root();

root.loadSync('src/example/proto/task_list.proto');

let content = `
import { generateObjectPrototype, Schema, WarpList } from "../../core/schema";

`

content += codegenSchema(root);
content += `export const schema = Schema.fromJson(schemaJson);\n`

for(const type of iterTypes(root)) {
  if(type.options?.['(warp_object)'] !== true) {
    continue;
  }

  content += codegenClass(type);
  content += `\n`;
}

writeFileSync('src/example/gen/schema.ts', content);