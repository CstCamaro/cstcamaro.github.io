import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname,'../dist');
const config = JSON.parse(await fs.readFile(new URL('../site.config.json',import.meta.url),'utf8'));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.xml':'application/xml; charset=utf-8','.json':'application/json','.txt':'text/plain; charset=utf-8'};
http.createServer(async (req,res) => {
  try {
    const requested = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const base = config.basePath.replace(/\/$/,'');
    if (requested === '/' && base) { res.writeHead(302,{Location:`${base}/`}).end(); return; }
    if (base && requested !== base && !requested.startsWith(base+'/')) throw new Error('Not found');
    let file = path.resolve(root,'.'+(requested.slice(base.length)||'/'));
    if (file !== root && !file.startsWith(root+path.sep)) throw new Error('Not found');
    if ((await fs.stat(file)).isDirectory()) {
      if (!requested.endsWith('/')) {res.writeHead(302,{Location:requested+'/'}).end();return;}
      file = path.join(file,'index.html');
    }
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
    res.end(await fs.readFile(file));
  } catch {res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'}); res.end(await fs.readFile(path.join(root,'404.html')).catch(()=> 'Run npm run build first.'));}
}).listen(4173,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:4173${config.basePath}/`));
