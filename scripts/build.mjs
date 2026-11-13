import {mkdir,copyFile,cp,readFile,writeFile,rm} from 'node:fs/promises';
// Publish only application assets; never personal scans, uploads, or credentials.
await rm('dist', {recursive:true,force:true});
await mkdir('dist/docs',{recursive:true});
for (const dir of ['css','js']) await cp(dir,`dist/${dir}`,{recursive:true});
await mkdir('dist/assets',{recursive:true});
for (const file of ['forest.png','heart.png']) await copyFile(`assets/${file}`,`dist/assets/${file}`);
await copyFile('docs/google-signin.md','dist/docs/google-signin.md');
let html=await readFile('index.html','utf8');
html=html.replace('<html ', '<html data-hosting="static" ');
await writeFile('dist/index.html',html);
