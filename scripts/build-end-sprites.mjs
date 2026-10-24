/** Original vector pixel-art endings. No original image is read or transformed. */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../assets/characters/', import.meta.url));
// Final-cell alpha bounds measured in Chromium, before cell clipping. These
// per-pose offsets place the lowest authored pixel exactly on row 549.
const FLOOR_CORRECTION = { leo: 5, vini: -15, rodolfo: -5, eduardo: -5, gui: -21, dantas: 3, caio: -44, thales: -3 };
export const PALETTES = {
  leo: { skin:'#cf8a4a', shade:'#ad652d', hair:'#101111', shirt:'#151515', trim:'#dbb52b', pants:'#426bcb', shoes:'#121829', pose:'salute' },
  vini: { skin:'#ffd0ae', shade:'#d79f7b', hair:'#332010', shirt:'#c9ccca', trim:'#17440b', pants:'#555957', shoes:'#414543', pose:'shield' },
  rodolfo: { skin:'#fbc5ab', shade:'#e5a98a', hair:'#342317', shirt:'#080858', trim:'#ffffff', pants:'#517992', shoes:'#10110e', pose:'point' },
  eduardo: { skin:'#ffb34d', shade:'#d9973c', hair:'#242323', shirt:'#f1e8dc', trim:'#b0dfec', pants:'#37362f', shoes:'#5b482f', pose:'cross' },
  gui: { skin:'#694312', shade:'#4d2e0a', hair:'#101111', shirt:'#450064', trim:'#5aadff', pants:'#3d005c', shoes:'#c5f42d', pose:'ball' },
  dantas: { skin:'#e7c492', shade:'#b49a73', hair:'#100c03', shirt:'#080719', trim:'#ffffff', pants:'#b59f46', shoes:'#c5c6c7', pose:'controller' },
  caio: { skin:'#ffb27b', shade:'#e89259', hair:'#b19844', shirt:'#ffb27b', trim:'#e89259', pants:'#a90e00', shoes:'#3e2506', pose:'flex' },
  thales: { skin:'#edbd93', shade:'#ba8d66', hair:'#674726', shirt:'#f1f1ef', trim:'#dedfdd', pants:'#1a1a18', shoes:'#e9eceb', pose:'bow' }
};
const rect = (x,y,w,h,fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
function line(x1,y1,x2,y2,color,width=20) {
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1))/10));
  let result='';
  for(let i=0;i<=steps;i++){const t=i/steps;result+=rect(Math.round((x1+(x2-x1)*t-width/2)/5)*5,Math.round((y1+(y2-y1)*t-width/2)/5)*5,width,width,color)}
  return result;
}
function shield(x,y){return rect(x-40,y-50,80,100,'#9c9521')+rect(x-30,y-45,60,90,'#ece8de')+rect(x-20,y-45,15,90,'#a90000')+rect(x-30,y-12,60,15,'#b90000')+rect(x-15,y-15,30,25,'#f3ce00')}
function sword(x,y,up=true){return line(x,y,x+(up?-45:45),y+(up?-110:70),'#aaa79e',15)+rect(x-20,y-5,40,10,'#7c7364')+rect(x-5,y+5,10,25,'#54463b')}
function ball(x,y){return rect(x-30,y-30,60,60,'#ffffd1')+rect(x-30,y-5,60,15,'#f4e000')+rect(x-5,y-30,15,60,'#f4e000')+rect(x-30,y-30,15,15,'#5fb3ff')+rect(x+15,y+15,15,15,'#5fb3ff')}
function controller(x,y){return rect(x-35,y-15,70,35,'#101216')+rect(x-40,y,15,25,'#111317')+rect(x+25,y,15,25,'#111317')+rect(x-20,y-7,10,20,'#23ba23')+rect(x-25,y-2,20,10,'#23ba23')+rect(x+14,y-5,8,8,'#23ba23')}
function torsoDetails(id,p){
 let art='';
 if(id==='leo')for(const [x,y] of [[-45,-230],[-35,-220],[-15,-220],[25,-225],[35,-215],[15,-205],[-40,-200]])art+=rect(x,y,10,10,p.trim);
 if(id==='vini')art+=rect(-50,-240,25,35,p.trim)+rect(25,-240,25,35,p.trim)+rect(-40,-240,80,15,'#656969')+rect(-15,-210,30,85,'#930b07')+rect(-40,-185,80,20,'#930b07')+rect(-12,-190,25,25,'#edc000');
 if(id==='rodolfo')art+=rect(-30,-230,45,10,'#fff')+rect(-15,-230,10,35,'#fff')+rect(5,-210,10,65,'#fff')+rect(5,-210,40,10,'#fff')+rect(5,-183,30,10,'#fff')+rect(5,-155,40,10,'#fff')+rect(20,-140,20,10,'#fff')+rect(20,-140,10,25,'#fff')+rect(20,-120,20,10,'#fff');
 if(id==='eduardo')art+=rect(-7,-240,15,125,p.trim)+rect(-32,-220,30,10,'#c94f47')+rect(-22,-230,10,30,'#c94f47');
 if(id==='gui')art+=rect(-50,-220,10,115,p.trim)+rect(40,-220,10,115,p.trim)+rect(-15,-210,30,10,'#fff')+rect(-25,-200,10,60,'#fff')+rect(-15,-180,30,10,'#fff')+rect(15,-180,10,40,'#fff')+rect(-15,-150,30,10,'#fff');
 if(id==='dantas')art+=rect(-30,-225,10,30,'#fff')+rect(-20,-235,10,10,'#fff')+rect(-20,-205,10,10,'#fff')+rect(0,-235,10,40,'#fff')+rect(10,-215,10,10,'#fff')+rect(20,-185,10,30,'#fff')+rect(-30,-180,10,30,'#fff')+rect(-30,-180,25,10,'#fff')+rect(0,-170,10,20,'#fff');
 if(id==='caio')art+=rect(-35,-210,25,15,'#ffc08d')+rect(10,-210,25,15,'#ffc08d')+rect(-20,-170,15,10,p.shade)+rect(5,-170,15,10,p.shade)+rect(-20,-145,15,10,p.shade)+rect(5,-145,15,10,p.shade)+rect(-35,-120,70,10,'#111')+rect(-8,-120,16,10,'#ddd');
 if(id==='thales')art+=rect(-40,-235,80,10,p.trim)+rect(-40,-225,10,100,p.trim)+rect(30,-225,10,100,p.trim)+rect(-40,-135,80,10,p.trim)+rect(-15,-245,30,20,'#111');
 return art;
}
function avatar(id,p,frame,ending){
 const u=frame/5;
 let arms=[[-55,-225,-60,-140],[55,-225,60,-140]];
 let lean=0, headY=-300, bend=0;
 if(ending==='victory'){
  switch(p.pose){
   case 'salute':arms=[[-55,-225,-75,-150],[55,-225,20,-280+Math.round(u*10)]];break;
   case 'shield':arms=[[-55,-225,-85,-280-u*30],[55,-225,95,-195-u*30]];break;
   case 'point':arms=[[-55,-225,-90-u*45,-240],[55,-225,50,-150]];break;
   case 'cross':arms=[[-55,-225,10,-180],[55,-225,-10,-205]];headY-=Math.round(u*5);break;
   case 'ball':arms=[[-55,-225,-75,-155],[55,-225,70,-230-u*75]];break;
   case 'controller':arms=[[-55,-225,-12,-180],[55,-225,12,-180]];break;
   case 'flex':arms=[[-55,-225,-80,-285-u*10],[55,-225,80,-285-u*10]];break;
   case 'bow':arms=[[-55,-225,-35,-170],[55,-225,35,-170]];lean=[0,5,9,12,8,0][frame];break;
  }
  const reach=[0,.22,.58,.86,1,1][frame];
  const rest=[[-55,-225,-60,-140],[55,-225,60,-140]];
  arms=arms.map((arm,index)=>arm.map((value,axis)=>axis<2?value:rest[index][axis]+(value-rest[index][axis])*reach));
 }else{
  const fallPose={leo:[-35,-75,35,-125,18],vini:[-65,-170,30,-175,25],rodolfo:[-90,-95,65,-100,12],eduardo:[-45,-130,85,-160,30],gui:[-80,-70,70,-195,35],dantas:[-25,-160,25,-160,22],caio:[-105,-170,90,-190,40],thales:[-20,-170,35,-200,28]}[id];
  arms=[[-55,-225,-60+(fallPose[0]+60)*u,-140+(fallPose[1]+140)*u],[55,-225,60+(fallPose[2]-60)*u,-140+(fallPose[3]+140)*u]];
  bend=frame>=2?Math.round(fallPose[4]*u):0;
 }
 let art='';
 // Rear limbs are authored into every cell; there is no browser-side pose transform.
 for(const [x1,y1,x2,y2]of arms){art+=line(x1,y1,x2,y2,p.skin,25);art+=rect(x1-12,y1-12,25,35,id==='caio'?p.skin:p.shirt);art+=rect(x2-13,y2-13,26,26,p.skin)}
 // Slightly different leg silhouettes distinguish the celebration and final fall.
 const stride=ending==='victory'?(p.pose==='flex'?12:p.pose==='point'?8:0):bend;
 art+=rect(-40,-115,35,100,p.pants)+rect(5,-115,35,100-bend,p.pants);
 if(['leo','rodolfo','gui','caio'].includes(id))art+=rect(-40,-50,35,35,p.skin)+rect(5,-50-bend,35,35,p.skin);
 if(id==='leo')art+=rect(-40,-90,35,10,'#121d39')+rect(5,-90,35,10,'#121d39')+rect(-40,-65,35,10,'#121d39')+rect(5,-65,35,10,'#121d39');
 art+=rect(-50-stride,-20,45,20,p.shoes)+rect(5+stride,-20-bend,45,20,p.shoes);
 if(id==='gui')art+=rect(-50-stride,-20,45,8,'#5cb8ff')+rect(5+stride,-20,45,8,'#5cb8ff');
 art+=rect(-50,-240,100,130,p.shirt)+rect(-40,-250,80,20,p.shirt)+torsoDetails(id,p);
 // Face, hair and facial features preserve the character's palette and silhouette.
 art+=rect(-25,headY-10,55,65,p.skin)+rect(20,headY+10,10,40,p.shade)+rect(-35,headY+15,10,25,p.skin);
 if(id==='dantas')art+=rect(-45,headY-30,80,20,p.hair)+rect(-55,headY-20,20,70,p.hair)+rect(25,headY-20,25,70,p.hair)+rect(-35,headY+45,65,10,p.hair);
 else if(id==='eduardo')art+=rect(-30,headY-25,60,20,p.hair)+rect(-40,headY-15,80,20,p.hair)+rect(-25,headY-35,45,15,p.hair);
 else art+=rect(-30,headY-20,65,20,p.hair)+rect(20,headY-10,15,25,p.hair);
 if(id==='rodolfo')art+=rect(0,headY-20,10,10,'#f8eee4');
 if(id==='gui')art+=rect(-25,headY-25,15,10,'#050505')+rect(0,headY-25,15,10,'#050505');
 const eyesClosed=ending==='defeat'&&frame>=3;
 art+=rect(-25,headY+10,17,eyesClosed?4:10,'#fff')+rect(-16,headY+10,8,eyesClosed?4:10,'#111')+rect(3,headY+10,17,eyesClosed?4:10,'#fff')+rect(3,headY+10,8,eyesClosed?4:10,'#111');
 art+=rect(-10,headY+35,20,7,p.shade);
 if(id==='thales')art+=rect(-20,headY+45,45,20,'#352416')+rect(-5,headY+35,20,10,'#49351e');
 if(id==='vini'){art+=shield(arms[1][2]+20,arms[1][3]+10);art+=sword(arms[0][2]-5,arms[0][3]+10,ending==='victory')}
 if(id==='eduardo'){art+=sword(arms[0][2],arms[0][3],ending==='victory');art+=sword(arms[1][2],arms[1][3],ending==='victory')}
 if(id==='gui')art+=ball(arms[1][2]+8,arms[1][3]-15);
 if(id==='dantas')art+=controller(0,ending==='victory'?-175:-135+frame*6);
 return `<g transform="rotate(${lean} 0 -160)">${art}</g>`;
}
export async function build(){
 for(const [id,p]of Object.entries(PALETTES)){
  const path=join(root,id);await mkdir(path,{recursive:true});
  for(const ending of ['victory','defeat']){
   let cells='';
   for(let frame=0;frame<6;frame++){
    const progress=[0,.10,.30,.58,.86,1][frame];
    const direction={leo:1,vini:-1,rodolfo:1,eduardo:-1,gui:1,dantas:-1,caio:1,thales:-1}[id];
    let x=225,y=550,angle=0;
    if(ending==='defeat'){x=225-direction*135*progress;y=550-75*progress+FLOOR_CORRECTION[id]*progress;angle=direction*(90+(id==='caio'?4:id==='gui'?-4:0))*progress}
    // Cell clip guarantees the loader can index the strip without frame bleed.
    cells+=`<svg x="${frame*450}" y="0" width="450" height="550" viewBox="0 0 450 550"><g transform="translate(${x} ${y}) rotate(${angle})">${avatar(id,p,frame,ending)}</g></svg>`;
   }
   const title=`${id}: ${ending==='victory'?'vitória — '+p.pose:'derrota — queda única e pose final'}`;
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="2700" height="550" viewBox="0 0 2700 550" shape-rendering="crispEdges"><title>${title}</title>${cells}</svg>\n`;
   await writeFile(join(path,`${ending}.svg`),svg);
  }
 }
}
if(process.argv[1]===fileURLToPath(import.meta.url))await build();
