import { readFile, access } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";

const root=resolve(process.argv[2]||"");
if(!process.argv[2]) { console.error("Usage: node scripts/validate-live2d.mjs <model3.json path>"); process.exit(2); }
const model=JSON.parse(await readFile(root,"utf8"));
const references=model.FileReferences||{};
const files=[
 references.Moc,
 ...(references.Textures||[]),
 references.Physics,
 references.DisplayInfo,
 ...Object.values(references.Motions||{}).flat().map(m=>m.File),
 ...(references.Expressions||[]).map(e=>e.File),
].filter(Boolean);
const missing=[];
for(const file of files) {
 if(file.startsWith("/")||file.split(/[\\/]/).includes("..")) {missing.push(file+" (unsafe relative path)");continue;}
 try {await access(join(dirname(root),file));}catch{missing.push(file);}
}
console.log(JSON.stringify({model:root,version:model.Version,assets:files.length,expressions:(references.Expressions||[]).length,motionGroups:Object.keys(references.Motions||{}),missing},null,2));
if(missing.length)process.exitCode=1;
