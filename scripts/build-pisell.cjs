const fs=require('node:fs/promises');
const path=require('node:path');
const esbuild=require('esbuild');
const base=path.resolve(__dirname,'..'),out=path.join(base,'pisell-web');
async function build(){
 await fs.mkdir(out,{recursive:true});
 for(const name of ['styles.css','immersive.css'])await fs.copyFile(path.join(base,'src',name),path.join(out,name));
 for(const name of ['index.html','pisell.css','profile.js','embed.js','admin.html','admin.css'])await fs.copyFile(path.join(base,'src/web',name),path.join(out,name));
 await fs.cp(path.join(base,'src/assets/landmarks'),path.join(out,'assets/landmarks'),{recursive:true});
 for(const name of ['maps-surface.jpg','maps-elevation.jpg'])await fs.copyFile(path.join(base,'src/assets',name),path.join(out,'assets',name));
 await fs.copyFile(path.join(base,'src/web/pisell-logo.png'),path.join(out,'assets/pisell-logo.png'));
 let html=await fs.readFile(path.join(base,'src/index.html'),'utf8');
 html=html.replace('YIFUN · Global Case Atlas','PISELL · Global stories').replace('#030b18','#f5f3f2').replace('href="immersive.css"','href="immersive.css"><link rel="stylesheet" href="pisell.css"').replace('YIFUN · Back to world','PISELL · Back to world').replace('<strong>YIFUN<span class="brand-life">LIFE</span></strong>','<img src="assets/pisell-logo.png" alt="PISELL">').replace('GLOBAL CASE ATLAS<span>PLAYSPACE DESIGN &amp; BUILD</span>','GLOBAL STORIES<span>CONNECTED BY BUSINESS</span>').replace('<script src="app.js">','<script src="profile.js"></script><script src="host.js"></script><script src="app.js">');
 html=html.replace('</head>','<link rel="stylesheet" href="leaflet.css"></head>');
 html=html.replace('</head>','<link rel="icon" href="assets/pisell-logo.png"></head>');
 await fs.writeFile(path.join(out,'atlas.html'),html);
 esbuild.buildSync({entryPoints:[path.join(base,'src/experience/app.js')],bundle:true,outfile:path.join(out,'app.js'),minify:true,target:'es2020',legalComments:'none'});
 for(const name of ['host','admin'])esbuild.buildSync({entryPoints:[path.join(base,'src/web',name+'.js')],bundle:true,outfile:path.join(out,name+'.js'),minify:true,target:'es2020',legalComments:'none'});
 const data=JSON.parse(await fs.readFile(path.join(base,'src/web/data/customers.json'),'utf8'));
 await fs.cp(path.join(base,'src/web/assets/customers'),path.join(out,'assets/customers'),{recursive:true});
 await fs.copyFile(path.join(base,'node_modules/leaflet/dist/leaflet.css'),path.join(out,'leaflet.css'));
 await fs.writeFile(path.join(out,'cases.json'),JSON.stringify({items:data.items},null,2));
 const publish=path.join(out,'build');await fs.mkdir(publish,{recursive:true});
 for(const name of ['index.html','atlas.html','styles.css','immersive.css','pisell.css','leaflet.css','profile.js','host.js','embed.js','app.js','cases.json','admin.html','admin.css','admin.js'])await fs.copyFile(path.join(out,name),path.join(publish,name));
 await fs.mkdir(path.join(publish,'assets'),{recursive:true});
 for(const name of ['maps-surface.jpg','maps-elevation.jpg','pisell-logo.png'])await fs.copyFile(path.join(out,'assets',name),path.join(publish,'assets',name));
 await fs.cp(path.join(out,'assets/landmarks'),path.join(publish,'assets/landmarks'),{recursive:true});
 for(const item of data.items)for(const photo of item.photos){await fs.mkdir(path.dirname(path.join(publish,photo)),{recursive:true});await fs.copyFile(path.join(out,photo),path.join(publish,photo));}
 console.log(`Pisell web built: ${out} (${data.items.length} customer locations)`);
}
build().catch(e=>{console.error(e);process.exitCode=1});
