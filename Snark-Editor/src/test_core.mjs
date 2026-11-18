// Tests of the Snark core (snark_core.js): reading, writing, recognition, evaluation, final export, Boojum.
// Run from anywhere:  node Snark-Editor/src/test_core.mjs      (Node 18 or newer, no packages needed)
import * as S from './snark_core.js';
import fs from 'fs';
const EX = new URL('../../standards/snark/examples/', import.meta.url);
let fails=0; const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m); if(!c) fails++;};
const near=(a,b,e)=>Math.abs(a-b)<=e;
// 1. rotations
{ let worst=0, worstQ=0;
  for(let i=0;i<500;i++){ const e=[Math.random()*340-170, Math.random()*170-85, Math.random()*340-170];
    const F=S.Rot.frameFromEuler(e), e2=S.Rot.eulerFromFrame(F); worst=Math.max(worst,...e.map((v,k)=>Math.abs(v-e2[k])));
    const q=S.Rot.quatFromEuler(e), q2=S.Rot.quatFromFrame(S.Rot.frameFromQuat(q)); const sg=Math.sign(q[3])||1; worstQ=Math.max(worstQ,...q.map((v,k)=>Math.abs(v*sg-q2[k]))); }
  ok(worst<1e-8 && worstQ<1e-12, `euler -> frame -> euler and quat -> frame -> quat round trips (worst ${worst.toExponential(1)} deg, ${worstQ.toExponential(1)})`); }
// 2. repo examples: parse, write, parse again, write again -> same text
for(const f of ['plate_bump','plate_hole']){
  const txt=fs.readFileSync(new URL(f+'.snark', EX),'utf8');
  const d=S.parseSnark(txt), t1=S.writeSnark(d), t2=S.writeSnark(S.parseSnark(t1));
  ok(t1===t2, `${f}: write(parse(write(parse(file)))) is stable; issues: ${JSON.stringify(d.issues)}`);
  console.log(`      ${f}: ${d.pos.length/3} vertices, ${d.faces.length} faces, ${d.patches.size} patches, profiles ${d.profiles.size}, features ${d.features.length}, patterns ${d.patterns.length}, recipe ${d.recipe.length}, seams ${d.seams.length}`);
  const st=S.docToState(d); console.log(`      recognised: ${st.objects.map(o=>o.kind+' '+o.size.join('x')+' at '+o.p.map(S.fmt)+' edge '+o.edge.rule+':'+o.edge.t+' keys '+o.edge.keys.length).join('; ')||'-'}; foreign bodies ${st.foreign.bodies.length}; issues ${JSON.stringify(st.issues.filter(i=>i.level!=='info'))}`);
}
// 3. demo objects: build -> write -> parse -> recognise -> same objects
const demo={ meta:{title:'demo'}, objects:[
  {id:1,kind:'box',name:'ყუთი',size:[50,35,20],p:[35,30,10],rot:[0,0,0],edge:{rule:'spline',t:4,k:0.55,keys:S.EDGE_SETS.box.all}},
  {id:2,kind:'cyl',name:'',size:[30,30],p:[95,30,15],rot:[0,0,0],edge:{rule:'spline',t:4,k:0.75,keys:['top','bottom']}},
  {id:3,kind:'sph',name:'',size:[30],p:[150,30,15],rot:[0,0,0],edge:{rule:'sharp',t:2,k:0.55,keys:[]}},
  {id:4,kind:'box',name:'',size:[30,20,10],p:[40,90,25],rot:[20,-35,50],edge:{rule:'round',t:3,k:0.55,keys:S.EDGE_SETS.box.topvert}},
  {id:5,kind:'cyl',name:'',size:[16,40],p:[100,90,30],rot:[90,0,30],edge:{rule:'chamfer',t:2,k:0.55,keys:['top']}},
  {id:6,kind:'box',name:'',size:[20,20,20],p:[150,90,10],rot:[0,0,90],edge:{rule:'chamfer',t:3,k:0.55,keys:S.EDGE_SETS.box.vertical}},
]};
{ const d=S.buildDoc(demo), t1=S.writeSnark(d), d2=S.parseSnark(t1), t2=S.writeSnark(d2), st=S.docToState(d2);
  ok(t1===t2, 'demo: text stable after write -> parse -> write ('+t1.split('\n').length+' lines)');
  ok(d2.issues.length===0, 'demo: no parse issues '+JSON.stringify(d2.issues));
  ok(st.issues.length===0, 'demo: no recognition issues '+JSON.stringify(st.issues));
  let worst=0, same=true;
  demo.objects.forEach((o,i)=>{ const r=st.objects[i]; if(!r||r.kind!==o.kind){same=false;return;}
    const F1=S.Rot.frameFromEuler(o.rot), F2=S.Rot.frameFromEuler(r.rot);
    worst=Math.max(worst,...o.size.map((v,k)=>Math.abs(v-r.size[k])),...o.p.map((v,k)=>Math.abs(v-r.p[k])), ...(o.kind==='sph'?[]:F1.flat().map((v,k)=>Math.abs(v-F2.flat()[k]))), Math.abs(o.edge.t-r.edge.t)*(o.edge.keys.length?1:0));
    if(o.edge.keys.length && (r.edge.rule!==o.edge.rule || [...o.edge.keys].sort().join()!==[...r.edge.keys].sort().join() || (o.edge.rule==='spline'&&Math.abs(o.edge.k-r.edge.k)>1e-6))) same=false; });
  ok(same && worst<2e-6, `demo: objects come back the same from the file (largest difference ${worst.toExponential(1)})`);
  const t3=S.writeSnark(S.buildDoc(st)); ok(t3===t1, 'demo: objects -> file -> objects -> file gives the same text');
  globalThis.demoText=t1;
}
// 4. evaluation: closed meshes, volumes against formulas
const one=(o)=>{ const d=S.parseSnark(S.writeSnark(S.buildDoc({objects:[o]}))); return d; };
const evalObj=(o,chord)=>{ const d=one(o), ev=S.evaluate(d,chord), b=ev.bodies[0]; const m=S.weld(b.pieces), st=S.meshStats(m); return {st,b,d,ev}; };
const steiner=(X,Y,Z,R)=>(X-2*R)*(Y-2*R)*(Z-2*R)+2*R*((X-2*R)*(Y-2*R)+(Y-2*R)*(Z-2*R)+(X-2*R)*(Z-2*R))+Math.PI*R*R*((X-2*R)+(Y-2*R)+(Z-2*R))+4/3*Math.PI*R**3;
const cases=[
  ['box all R4',{id:1,kind:'box',size:[50,35,20],p:[0,0,0],rot:[0,0,0],edge:{rule:'round',t:4,keys:S.EDGE_SETS.box.all}}, steiner(50,35,20,4)],
  ['box all R4, rotated',{id:1,kind:'box',size:[50,35,20],p:[7,-3,11],rot:[20,-35,50],edge:{rule:'round',t:4,keys:S.EDGE_SETS.box.all}}, steiner(50,35,20,4)],
  ['box all chamfer 3',{id:1,kind:'box',size:[50,35,20],p:[0,0,0],rot:[0,0,0],edge:{rule:'chamfer',t:3,keys:S.EDGE_SETS.box.all}}, 50*35*20-4.5*(4*(50-6)+4*(35-6)+4*(20-6))-8*5/6*27],
  ['box vertical R4',{id:1,kind:'box',size:[50,35,20],p:[0,0,0],rot:[0,0,0],edge:{rule:'round',t:4,keys:S.EDGE_SETS.box.vertical}}, 50*35*20-4*(1-Math.PI/4)*16*20],
  ['box top R4 (mitre corners)',{id:1,kind:'box',size:[50,35,20],p:[0,0,0],rot:[0,0,0],edge:{rule:'round',t:4,keys:S.EDGE_SETS.box.top}}, 50*35*20-16*(1-Math.PI/4)*(2*50+2*35)+4*64*(5/3-Math.PI/2)],
  ['box top+vertical R4',{id:1,kind:'box',size:[50,35,20],p:[0,0,0],rot:[0,0,0],edge:{rule:'round',t:4,keys:S.EDGE_SETS.box.topvert}}, null],
  ['box spline k=kappa',{id:1,kind:'box',size:[50,35,20],p:[0,0,0],rot:[0,0,0],edge:{rule:'spline',t:4,k:S.KAPPA,keys:S.EDGE_SETS.box.all}}, null],
  ['box spline k=0.9',{id:1,kind:'box',size:[50,35,20],p:[0,0,0],rot:[0,0,0],edge:{rule:'spline',t:4,k:0.9,keys:S.EDGE_SETS.box.all}}, null],
  ['box spline k=0',{id:1,kind:'box',size:[50,35,20],p:[0,0,0],rot:[0,0,0],edge:{rule:'spline',t:3,k:0,keys:S.EDGE_SETS.box.all}}, 50*35*20-4.5*(4*(50-6)+4*(35-6)+4*(20-6))-8*5/6*27],
  ['box sharp',{id:1,kind:'box',size:[50,35,20],p:[0,0,0],rot:[0,0,0],edge:{rule:'sharp',t:4,keys:[]}}, 35000],
  ['box R = half thickness',{id:1,kind:'box',size:[50,35,8],p:[0,0,0],rot:[0,0,0],edge:{rule:'round',t:4,keys:S.EDGE_SETS.box.all}}, steiner(50,35,8,4)],
];
const cylV=(r,h,R,n)=>Math.PI*r*r*h-n*2*Math.PI*(R*(r*r-(r-R)**2)/2-(r-R)*Math.PI*R*R/4-R**3/3);
const cylC=(r,h,a,n)=>Math.PI*r*r*h-n*2*Math.PI*(a*a/2*(r-a/3));
cases.push(['cyl both R4',{id:1,kind:'cyl',size:[30,30],p:[0,0,0],rot:[0,0,0],edge:{rule:'round',t:4,keys:['top','bottom']}}, cylV(15,30,4,2)]);
cases.push(['cyl top R4, tilted',{id:1,kind:'cyl',size:[30,30],p:[5,6,7],rot:[90,0,30],edge:{rule:'round',t:4,keys:['top']}}, cylV(15,30,4,1)]);
cases.push(['cyl both chamfer 2',{id:1,kind:'cyl',size:[30,30],p:[0,0,0],rot:[0,0,0],edge:{rule:'chamfer',t:2,keys:['top','bottom']}}, cylC(15,30,2,2)]);
cases.push(['cyl spline k=0.75',{id:1,kind:'cyl',size:[30,30],p:[0,0,0],rot:[0,0,0],edge:{rule:'spline',t:4,k:0.75,keys:['top','bottom']}}, null]);
cases.push(['cyl R = radius (dome)',{id:1,kind:'cyl',size:[20,30],p:[0,0,0],rot:[0,0,0],edge:{rule:'round',t:10,keys:['top']}}, Math.PI*100*20+2/3*Math.PI*1000]);
cases.push(['sphere d30',{id:1,kind:'sph',size:[30],p:[1,2,3],rot:[0,0,0],edge:{rule:'sharp',keys:[]}}, 4/3*Math.PI*15**3]);
for(const [name,o,V] of cases){
  // every vertex lies on the exact surface, so for convex shapes the mesh is inside it, by less than one chord
  const res=[]; for(const ch of [0.05,0.004,0.002]){ const r=evalObj(o,ch); const m=S.weld(r.b.pieces); let A=0; for(let i=0;i<m.idx.length;i+=3){ const P=[0,1,2].map(e=>m.pos.slice(3*m.idx[i+e],3*m.idx[i+e]+3)); const u=P[1].map((v,k)=>v-P[0][k]), w=P[2].map((v,k)=>v-P[0][k]); A+=Math.hypot(u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0])/2; } res.push({...r.st,ch,A}); }
  const c=res[2], within=V===null || res.every(r=> r.volume<=V*(1+1e-9)+1e-9 && V-r.volume<=r.ch*r.A);
  ok(res.every(r=>r.open===0&&r.dup===0) && within, `${name}: closed at 3 resolutions; triangles ${res[0].tris} -> ${c.tris}; volume ${c.volume.toFixed(3)}${V?` vs formula ${V.toFixed(3)}: inside by ${(V-c.volume).toFixed(4)} mm3, allowed ${(c.ch*c.A).toFixed(4)}`:''}`);
}
{ const v1=evalObj({id:1,kind:'box',size:[50,35,20],p:[0,0,0],rot:[0,0,0],edge:{rule:'spline',t:4,k:S.KAPPA,keys:S.EDGE_SETS.box.all}},0.0005).st.volume, v2=evalObj({id:1,kind:'box',size:[50,35,20],p:[0,0,0],rot:[0,0,0],edge:{rule:'round',t:4,keys:S.EDGE_SETS.box.all}},0.0005).st.volume;
  ok(Math.abs(v1-v2)/v2<1e-4, `spline with k=0.5523 is almost the R4 round: volumes ${v1.toFixed(3)} and ${v2.toFixed(3)}`); }
// 5. smoothness: normals of different pieces at the same point
const seamAngle=(o,ch)=>{ const {b}=evalObj(o,ch); const m=new Map(); for(const pc of b.pieces) for(let i=0;i<pc.pos.length;i+=3){ const k=pc.pos.slice(i,i+3).map(x=>Math.round(x/1e-6)).join(); const n=pc.nrm.slice(i,i+3); if(!m.has(k)) m.set(k,[]); m.get(k).push(n);} let worst=0; for(const L of m.values()) for(let i=1;i<L.length;i++){ const d=Math.min(1,L[0][0]*L[i][0]+L[0][1]*L[i][1]+L[0][2]*L[i][2]); worst=Math.max(worst,Math.acos(d)*180/Math.PI);} return worst; };
ok(seamAngle(cases[0][1],0.05)<1e-4, `box round: normals agree across every seam (largest break ${seamAngle(cases[0][1],0.05).toExponential(1)} deg)`);
ok(seamAngle(cases[6][1],0.05)<1e-4, `box spline k=kappa: no break at seams (${seamAngle(cases[6][1],0.05).toExponential(1)} deg)`);
ok(seamAngle(cases[7][1],0.05)<1e-4, `box spline k=0.9: no break at seams (${seamAngle(cases[7][1],0.05).toExponential(1)} deg)`);
ok(Math.abs(seamAngle(cases[2][1],0.05)-54.7356)<0.01, `box chamfer: breaks are real edges, largest ${seamAngle(cases[2][1],0.05).toFixed(4)} deg (corner triangle against a face: 54.7356)`);
ok(seamAngle(cases[11][1],0.05)<1e-4, `cylinder round: smooth (${seamAngle(cases[11][1],0.05).toExponential(1)} deg)`);
// sphere corners of a round box lie on the sphere of radius R
{ const {b}=evalObj(cases[0][1],0.01); let dev=0; for(const pc of b.pieces) if(pc.role.kind==='corner'){ const s=pc.role.s, c=[s[0]*(25-4),s[1]*(17.5-4),s[2]*(10-4)]; for(let i=0;i<pc.pos.length;i+=3) dev=Math.max(dev,Math.abs(Math.hypot(pc.pos[i]-c[0],pc.pos[i+1]-c[1],pc.pos[i+2]-c[2])-4)); }
  ok(dev<1e-12, `round box: every corner point lies on a sphere R4 around the inner point (deviation ${dev.toExponential(1)})`); }
{ const {b}=evalObj(cases[2][1],0.01); let dev=0; for(const pc of b.pieces) if(pc.role.kind==='corner'){ const s=pc.role.s; for(let i=0;i<pc.pos.length;i+=3){ const q=[ (s[0]*pc.pos[i]-(25-3))/3, (s[1]*pc.pos[i+1]-(17.5-3))/3, (s[2]*pc.pos[i+2]-(10-3))/3 ]; dev=Math.max(dev,Math.abs(q[0]+q[1]+q[2]-1)); } }
  ok(dev<1e-12, `chamfer box: each corner is one flat triangle (deviation from its plane ${dev.toExponential(1)})`); }
// 6. a final-mesh file for other programs: closed, same volume, cards where exact
{ const fd=S.buildFinalDoc({objects:[cases[0][1]]},0.01), txt=S.writeSnark(fd), d=S.parseSnark(txt), rec=S.recognise(d);
  const m={pos:d.pos,idx:d.faces.flatMap(f=>f.v.length===3?f.v:[f.v[0],f.v[1],f.v[2],f.v[0],f.v[2],f.v[3]])}, st=S.meshStats(m), ev=evalObj(cases[0][1],0.01).st;
  const types={}; for(const p of d.patches.values()) types[p.card?p.card.type:'none']=(types[p.card?p.card.type:'none']||0)+1;
  ok(st.open===0 && Math.abs(st.volume-ev.volume)<1e-3 && rec.bodies.length===1 && rec.bodies[0].kind==='mesh', `final file: ${d.faces.length} faces, closed (open ${st.open}), volume ${st.volume.toFixed(3)} = evaluated ${ev.volume.toFixed(3)}; patch cards ${JSON.stringify(types)}; read back as a stored mesh`);
  // every vertex of a card patch lies on the card
  let dev=0; for(const p of d.patches.values()){ const c=p.card; if(!c) continue; for(const fi of p.faces) for(const k of d.faces[fi].v){ const q=[d.pos[3*k],d.pos[3*k+1],d.pos[3*k+2]];
    if(c.type==='plane') dev=Math.max(dev,Math.abs((q[0]-c.o[0])*c.n[0]+(q[1]-c.o[1])*c.n[1]+(q[2]-c.o[2])*c.n[2]));
    if(c.type==='cyl'){ const r=[q[0]-c.o[0],q[1]-c.o[1],q[2]-c.o[2]], t=r[0]*c.a[0]+r[1]*c.a[1]+r[2]*c.a[2]; dev=Math.max(dev,Math.abs(Math.hypot(r[0]-t*c.a[0],r[1]-t*c.a[1],r[2]-t*c.a[2])-c.d/2)); }
    if(c.type==='sph') dev=Math.max(dev,Math.abs(Math.hypot(q[0]-c.c[0],q[1]-c.c[1],q[2]-c.c[2])-c.d/2)); } }
  ok(dev<=2e-6, `final file: every vertex lies on its patch card (largest deviation ${dev.toExponential(1)} mm)`);
  const fc=S.buildFinalDoc({objects:[cases[11][1]]},0.01), dc=S.parseSnark(S.writeSnark(fc)); const tt={}; for(const p of dc.patches.values()) tt[p.card?p.card.type:'none']=(tt[p.card?p.card.type:'none']||0)+1;
  const mc={pos:dc.pos,idx:dc.faces.flatMap(f=>f.v.length===3?f.v:[f.v[0],f.v[1],f.v[2],f.v[0],f.v[2],f.v[3]])};
  ok(S.meshStats(mc).open===0, `final file of the rounded cylinder: closed; cards ${JSON.stringify(tt)}`);
}
// 7. disagreements (Boojum) and the trust order of §13
{ const base={meta:{},objects:[{id:1,kind:'box',name:'',size:[50,35,20],p:[35,30,10],rot:[0,0,0],edge:{rule:'round',t:4,k:0.55,keys:S.EDGE_SETS.box.all}},
                               {id:2,kind:'cyl',name:'',size:[30,30],p:[100,30,15],rot:[0,0,0],edge:{rule:'sharp',t:2,k:0.55,keys:[]}}]};
  const txt=S.writeSnark(S.buildDoc(base));
  const read=(t)=>{const d=S.parseSnark(t);const st=S.docToState(d);return {st,boo:st.issues.filter(i=>i.level==='boojum').map(i=>i.msg)};};
  let r=read(txt); ok(r.boo.length===0,'agreeing file: no Boojum');
  r=read(txt.replace('#@recipe 1 solid box x=50','#@recipe 1 solid box x=55'));
  ok(r.boo.length===1&&/size 55 x 35 x 20 in the recipe, 50 x 35 x 20 by the cards/.test(r.boo[0])&&r.st.objects[0].size[0]===55,
     'recipe says 55, cards say 50 (design): one Boojum, the recipe is followed → '+r.boo[0]);
  r=read(txt.replace('source=design','source=scan').replace('#@recipe 1 solid box x=50','#@recipe 1 solid box x=55'));
  ok(r.boo.length===1&&r.st.objects[0].size[0]===50,'the same with source=scan: the cards are followed (50)');
  r=read(txt.replace('#@recipe 1 solid box x=50 y=35 z=20 p=35,30,10','#@recipe 1 solid box x=50 y=35 z=20 p=35,30,10 q=0,0,0.258819045,0.965925826'));
  ok(r.boo.length===1&&/turns the body differently/.test(r.boo[0])&&Math.abs(r.st.objects[0].rot[2])<1e-6,'recipe turned 30° against the cards: Boojum, the cards are followed');
  r=read(txt.replace('p=35,30,10','p=40,30,10'));
  ok(r.boo.length===1&&/centre 40,30,10 in the recipe, 35,30,10 by the cards \(5 mm apart\)/.test(r.boo[0])&&r.st.objects[0].p[0]===40,'recipe centre moved 5 mm (design): Boojum, the recipe is followed');
  const moved=txt.replace(/^v 10 12\.5 0$/m,'v 10 12.5 1');
  r=read(moved); ok(r.boo.length===1&&/disagree by 1 mm/.test(r.boo[0])&&r.st.objects.length===2,'a point moved 1 mm off its plane (design): Boojum, the cards are followed');
  r=read(moved.replace('source=design','source=scan')); ok(r.boo.length===2&&r.boo.some(m=>/recipe step 1 \(box 50 x 35 x 20\): no body recognised/.test(m))&&r.st.objects.length===1&&r.st.foreign.bodies.length===1,'the same with source=scan: the body is kept as the measured mesh (and its recipe step matches nothing)');
  r=read(txt.replace(/(#@recipe 2 [^\n]*\n)/,'$1#@recipe 3 solid sph d=10 p=0,0,5\n'));
  ok(r.boo.length===1&&/recipe step 3 \(sph d10\): no body recognised in the mesh matches it/.test(r.boo[0]),'an extra recipe step without a body: Boojum');
  const again=S.writeSnark(S.buildDoc(read(txt.replace('#@recipe 1 solid box x=50','#@recipe 1 solid box x=55')).st));
  ok(read(again).boo.length===0&&/#@recipe 1 solid box x=55/.test(again),'after following the recipe, the file written back agrees with itself');
}
// 9. features (L2, from Snark_02): exact volumes, closed surfaces, both directions of the file, patterns, the rules of §8
{ const featVol=path=>{ let v=0; for(const run of S.samplePath(path,1e-5)) for(let i=1;i<run.pts.length;i++){ const [r0,h0]=run.pts[i-1],[r1,h1]=run.pts[i]; v+=(r1-r0)*(r0*h0+r1*h1)/2; } return 2*Math.PI*v; };
  const V=sh=>featVol(S.shapePath(sh));
  const cube=(feats,edge)=>({meta:{},objects:[{id:1,kind:'box',name:'',size:[40,40,40],p:[30,30,20],rot:[0,0,0],edge:edge||{rule:'sharp',t:2,k:0.55,keys:[]},features:feats}]});
  const cyl=feats=>({meta:{},objects:[{id:1,kind:'cyl',name:'',size:[40,30],p:[0,0,15],rot:[0,0,0],edge:{rule:'round',t:3,k:0.55,keys:['top','bottom']},features:feats}]});
  const F=(face,at,shape,more={})=>({face,at,shape,blend:null,pattern:null,...more});
  const area=m=>{let a=0;for(let i=0;i<m.idx.length;i+=3){const P=[0,1,2].map(e=>m.idx[i+e]).map(j=>[m.pos[3*j],m.pos[3*j+1],m.pos[3*j+2]]);const u=P[1].map((x,k)=>x-P[0][k]),w=P[2].map((x,k)=>x-P[0][k]);a+=Math.hypot(u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0])/2;}return a;};
  const check=(name,state,chord,want,extra)=>{
    const t1=S.writeSnark(S.buildDoc(state)), d2=S.parseSnark(t1), t2=S.writeSnark(d2), st=S.docToState(d2), t3=S.writeSnark(S.buildDoc(st));
    const rec=S.recognise(d2), ev=S.evaluate(d2,chord,rec), B=ev.bodies[0], m=S.weld(B.pieces), ms=S.meshStats(m);
    const same=state.objects[0].features.map(S.featureKey).join('\n')===st.objects[0].features.map(S.featureKey).join('\n');
    const iss=[...rec.issues,...rec.bodies.flatMap(b=>b.issues),...B.issues].filter(i=>i.level!=='info'), volOk=want===undefined||Math.abs(ms.volume-want)<=chord*area(m);
    ok(t1===t2&&t1===t3&&same&&ms.open===0&&volOk&&(extra?extra({B,iss,t1}):iss.length===0),
      `${name}: write ⇄ read ${t1===t2&&t1===t3?'same':'DIFFERS'}, objects ${same?'same':'DIFFER'}; closed ${ms.open===0}; volume ${ms.volume.toFixed(2)}${want!==undefined?' (exact '+want.toFixed(2)+')':''}${iss.length?'; remarks: '+iss.map(i=>i.msg).join(' / '):''}`);
    return {B,iss,t1,rec,d2};
  };
  const dome={kind:'dome',R:8,h:3,k:0.45}, boss={kind:'boss',R:7,h:5,k:1}, crater={kind:'crater',R:9,h:2,k:0.55};
  for(const [n,sh,face] of [['dome',dome,'zp'],['dimple',{...dome,h:-3},'zp'],['boss with walls',boss,'zp'],['pocket',{...boss,h:-5},'xn'],['crater',crater,'yn']])
    check(`${n} on a box face`,cube([F(face,[20,20],sh)]),0.05,64000+V(sh));
  check('a feature on each of the six faces, spline edges 4',cube(['xn','xp','yn','yp','zn','zp'].map((f,i)=>F(f,[20,20],i%2?dome:{...boss,h:-4})),{rule:'spline',t:4,k:0.55,keys:S.EDGE_SETS.box.all}),0.05);
  const small={kind:'dome',R:2,h:0.8,k:0.4}, pat=(lattice)=>({lattice,region:{type:'all'},blend:null});
  check('square grid of pitch 5: 7 × 7 copies',cube([F('zp',[20,20],small,{pattern:pat({type:'rect',a:[5,0],b:[0,5]})})]),0.05,64000+49*V(small),({B,iss})=>iss.length===0&&B.pieces.filter(p=>p.type==='feature').length===49);
  check('honeycomb of pitch 6',cube([F('zp',[20,20],small,{pattern:pat({type:'rect',a:[6,0],b:[3,3*Math.sqrt(3)]})})]),0.05);
  check('8 on a circle of radius 12',cube([F('zp',[20,20],small,{pattern:pat({type:'polar',n:8,rad:12,phase:0})})]),0.05,64000+8*V(small));
  const two=rule=>cube([F('zp',[16,20],dome,{blend:rule}),F('zp',[26,20],dome,{blend:rule})]);
  check('two overlapping domes, sum: the volumes add',two({kind:'sum',v:0}),0.05,64000+2*V(dome));
  for(const r of ['mix:1','mix:0','max:0','max:0.5']) check(`two overlapping domes, ${r}`,two(S.parseBlend(r)),0.05);
  // max:k where the borders of two features cross (§8.2): the rounding must fade there, not leave a step of k/4
  { const path=S.shapePath({kind:'dome',R:3,h:2,k:0.45}), M=[-1.5,1.5].map(x=>({id:'d'+x,src:'d'+x,c:[x,0],R:3,path,blend:S.parseBlend('max:0.5')}));
    let jump=0, prev=S.blendHeight(M,0,2,1); for(let y=2;y<=2.7;y+=1e-5){ const h=S.blendHeight(M,0,y,1); jump=Math.max(jump,Math.abs(h-prev)); prev=h; }
    const fill=S.blendHeight(M,0,0,1)-S.blendHeight(M.map(m=>({...m,blend:{kind:'max',v:0}})),0,0,1);
    ok(jump<1e-4&&fill>0.1&&Math.abs(S.blendHeight(M,0,0.3,-1)+S.blendHeight(M,0,0.3,1))<1e-12,
      `max:0.5 where the borders of two domes cross: no step (largest change between points 1e-5 apart ${jump.toExponential(1)}); the valley between them still fills by ${fill.toFixed(3)}; with the heights turned over (animation) it acts as min`); }
  // the flat part around blended features: no needle triangles (they show as dark specks on a graphics card)
  { const r=check('8 domes on a circle of radius 4, overlapping, mix:1',cube([F('zp',[20,20],{kind:'dome',R:3,h:2,k:0.45},{pattern:{lattice:{type:'polar',n:8,rad:4,phase:0},region:{type:'all'},blend:S.parseBlend('mix:1')}})],{rule:'spline',t:6,k:0.55,keys:S.EDGE_SETS.box.all}),0.05);
    const flat=r.B.pieces.find(p=>p.role.kind==='face'&&p.role.m===2&&p.role.s===1); let worst=180;
    for(let i=0;i<flat.idx.length;i+=3){ const Q=[0,1,2].map(e=>flat.idx[i+e]).map(j=>[flat.pos[3*j],flat.pos[3*j+1]]), L=[0,1,2].map(e=>Math.hypot(Q[(e+1)%3][0]-Q[e][0],Q[(e+1)%3][1]-Q[e][1]));
      for(let e=0;e<3;e++){ const a=L[(e+1)%3], b=L[(e+2)%3], c=L[e]; worst=Math.min(worst,Math.acos(Math.max(-1,Math.min(1,(a*a+b*b-c*c)/(2*a*b))))*180/Math.PI); } }
    ok(worst>0.05,`its flat part has no needle triangles: smallest angle ${worst.toFixed(2)}° (ear clipping alone left 0.002°)`); }
  { let seed=7; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647; let bad=0;
    for(let trial=0;trial<500;trial++){ const outer=[[0,0],[60,0],[60,40],[0,40]], cs=[];
      for(let k=0;k<300&&cs.length<12;k++){ const c=[rnd()*60,rnd()*40],R=0.5+rnd()*5; if(c[0]<R+0.01||c[0]>60-R-0.01||c[1]<R+0.01||c[1]>40-R-0.01||cs.some(o=>Math.hypot(o.c[0]-c[0],o.c[1]-c[1])<o.R+R+0.01)) continue; cs.push({c,R,N:16+Math.floor(rnd()*100)}); }
      const P=[...outer], holes=cs.map(ci=>Array.from({length:ci.N},(_,k)=>{ P.push([ci.c[0]+ci.R*Math.cos(2*Math.PI*k/ci.N),ci.c[1]+ci.R*Math.sin(2*Math.PI*k/ci.N)]); return P.length-1; }));
      try{ const T=S.triangulateHoles(P,[0,1,2,3],holes), ar=t=>((P[t[1]][0]-P[t[0]][0])*(P[t[2]][1]-P[t[0]][1])-(P[t[1]][1]-P[t[0]][1])*(P[t[2]][0]-P[t[0]][0]))/2;
        const polyA=ids=>Math.abs(ids.reduce((s,id,i)=>{const p=P[id],q=P[ids[(i+1)%ids.length]];return s+p[0]*q[1]-q[0]*p[1];},0))/2;
        const want=2400-holes.reduce((s,h)=>s+polyA(h),0), got=T.reduce((s,t)=>s+ar(t),0), E=new Map();
        for(const t of T) for(let e=0;e<3;e++){ const a=t[e],b=t[(e+1)%3],k=a<b?a+','+b:b+','+a; E.set(k,(E.get(k)||0)+1); }
        if(Math.abs(got-want)>1e-6||T.some(t=>ar(t)<=0)||[...E.values()].some(n=>n>2)) bad++; }catch{ bad++; } }
    ok(bad===0,`flat parts with up to 12 holes, 500 random layouts: every triangulation covers exactly the area between the holes, all turned the same way, no edge used three times (${bad} bad)`); }
  check('a dome whose disk crosses the edge of a sharp cube: it goes over the edge (§7.5)',cube([F('zp',[3,20],dome)]),0.05,undefined,({B,iss})=>iss.every(i=>i.level==='info')&&!!B.skin);
  check('dome on a cylinder cap (rims R3)',cyl([F('top',[0,0],dome)]),0.05);
  check('6 bosses around the bottom cap',cyl([F('bottom',[0,0],{kind:'boss',R:3,h:2,k:0.5},{pattern:{lattice:{type:'polar',n:6,rad:10,phase:30},region:{type:'all'},blend:null}})]),0.05);
  { const r=check('min on raised domes is reported (§8.2)',two(S.parseBlend('min:0.5')),0.05,undefined,({iss})=>iss.length===1&&/blend min is for pockets/.test(iss[0].msg)); }
  { const r=check('animation: heights turned over (boss → dimple), max:0.5',two(S.parseBlend('max:0.5')),0.05);
    r.rec.bodies[0].featureScale=-1; const m=S.meshStats(S.weld(S.evaluate(r.d2,0.05,r.rec).bodies[0].pieces)); ok(m.open===0&&m.volume<64000,`… evaluated with height scale −1: closed, volume ${m.volume.toFixed(2)} (below the plain cube)`); }
  const ex=fs.readFileSync(new URL('plate_bump.snark',EX),'utf8'), st=S.docToState(S.parseSnark(ex)), t1=S.writeSnark(S.buildDoc(st)), t2=S.writeSnark(S.buildDoc(S.docToState(S.parseSnark(t1))));
  const ev=S.evaluate(S.parseSnark(t1),0.05), mm=S.meshStats(S.weld(ev.bodies[0].pieces));
  ok(t1===t2&&mm.open===0&&ev.bodies[0].pieces.filter(p=>p.type==='feature').length===13&&/#@feature groove1 curve/.test(t1)&&st.objects[0].features.length===2,
    `plate_bump: the boss and the 12 dimples are drawn and editable (${st.objects[0].features.map(f=>f.shape.kind+(f.pattern?' × pattern':'')).join(', ')}); the groove is kept as written; stable; closed`);
  const fin=S.buildFinalDoc(cube([F('zp',[20,20],boss),F('xp',[20,20],dome)],{rule:'round',t:3,k:0.55,keys:S.EDGE_SETS.box.all}),0.05);
  const fd=S.parseSnark(S.writeSnark(fin)), fm=S.meshStats(S.weld(S.evaluate(fd,0.05).bodies.flatMap(b=>b.pieces))), cards={};
  for(const q of fd.patches.values()) cards[q.card?q.card.type:'none']=(cards[q.card?q.card.type:'none']||0)+1;
  ok(fm.open===0&&fin.issues.length===0&&cards.free>=2,`final export with a boss and a dome: closed, cards ${JSON.stringify(cards)}`);
}
// 10. skins (from Snark_03): features over rounded edges and on spheres; the grid lies on the exact surface
{ const out=(m,c)=>{ let n=0; for(let i=0;i<m.idx.length;i+=3){ const P=[0,1,2].map(e=>m.idx[i+e]).map(j=>[m.pos[3*j],m.pos[3*j+1],m.pos[3*j+2]]), u=P[1].map((x,k)=>x-P[0][k]), v=P[2].map((x,k)=>x-P[0][k]);
    const nn=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]], g=P[0].map((x,k)=>(x+P[1][k]+P[2][k])/3-c[k]); if(nn[0]*g[0]+nn[1]*g[1]+nn[2]*g[2]<0) n++; } return n; };
  const F=(face,at,shape,more={})=>({face,at,shape,blend:null,pattern:null,...more});
  const box=(feats,edge)=>({id:1,kind:'box',name:'',size:[40,40,40],p:[30,30,20],rot:[0,0,0],edge:edge||{rule:'spline',t:6,k:0.55,keys:S.EDGE_SETS.box.all},features:feats});
  const read=(objects,chord=0.05)=>{ const t1=S.writeSnark(S.buildDoc({meta:{},objects})), d=S.parseSnark(t1), rec=S.recognise(d), e=S.evaluate(d,chord,rec), st=S.docToState(d);
    return { t1, t2:S.writeSnark(S.buildDoc(st)), d, rec, e, st }; };
  // the bare grid on the exact surface: the same volume as the exact drawing at a fine precision
  for(const edge of [{rule:'spline',t:6,k:0.55,keys:S.EDGE_SETS.box.all},{rule:'round',t:4,k:0.55,keys:S.EDGE_SETS.box.all},{rule:'chamfer',t:3,k:0.55,keys:S.EDGE_SETS.box.all},
    {rule:'round',t:5,k:0.55,keys:S.EDGE_SETS.box.topvert},{rule:'spline',t:20,k:0.55,keys:S.EDGE_SETS.box.all}]){
    const r=read([box([],edge)],0.002), b=r.rec.bodies[0], ex=S.meshStats(S.weld(r.e.bodies[0].pieces));
    const sk=S.makeSkin(b,0.05,[],[],{step:0.25}).update(b.edgePath.start[0]), m=S.weld(sk.pieces()), ms=S.meshStats(m);
    ok(ms.open===0&&out(m,b.c)===0&&ms.volume<=ex.volume+0.05&&ex.volume-ms.volume<5e-4*ex.volume,`bare skin, ${edge.rule} ${edge.t} on ${edge.keys.length} edges: closed, faces out, volume ${ms.volume.toFixed(2)} (exact drawing at 0.002 mm: ${ex.volume.toFixed(2)})`); }
  // a dome over the rounding: the skin; the file comes back the same
  { const r=read([box([F('zp',[5,20],{kind:'dome',R:8,h:3,k:0.45})])]), B=r.e.bodies[0], m=S.weld(B.pieces), ms=S.meshStats(m);
    ok(!!B.skin&&ms.open===0&&out(m,B.body.c)===0&&r.t1===r.t2&&ms.volume>60550+150,`a dome R8 at 5 mm from the edge (setback 6): drawn by the skin, closed, faces out, volume ${ms.volume.toFixed(2)}; the file comes back the same`); }
  { const r=read([box([F('zp',[20,20],{kind:'dome',R:8,h:3,k:0.45})])]), B=r.e.bodies[0];
    ok(!B.skin&&B.pieces.some(p=>p.type==='feature'),'a dome in the middle of the face: still the exact rings of Snark_02'); }
  // features on a sphere: written in the frame of its card, read back the same; a turned sphere turns them along
  { const sph={id:1,kind:'sph',name:'',size:[40],p:[0,0,20],rot:[0,0,0],edge:{rule:'sharp',t:2,k:0.55,keys:[]},
      features:[F('surface',[0,90],{kind:'boss',R:8,h:4,k:1}),F('surface',[30,0],{kind:'dome',R:4,h:2,k:0.45},{pattern:{lattice:{type:'polar',n:8,rad:28.284271,phase:0},region:{type:'all'},blend:null}})]};
    const r=read([sph]), B=r.e.bodies[0], m=S.weld(B.pieces), ms=S.meshStats(m), same=sph.features.map(S.featureKey).join('\n')===r.st.objects[0].features.map(S.featureKey).join('\n');
    ok(!!B.skin&&ms.open===0&&out(m,B.body.c)===0&&r.t1===r.t2&&same&&B.skin.insts.length===9&&/#@patch b1_surface sph c=0,0,20 d=40 a=0,0,1 u=1,0,0/.test(r.t1),
      `a sphere with a boss at the pole and 8 domes on the equator: the card carries the frame (a=, u=); 9 copies; closed, faces out; the file and the objects come back the same; volume ${ms.volume.toFixed(1)}`);
    const t2=JSON.parse(JSON.stringify(sph)); t2.rot=[30,20,10]; t2.q=S.Rot.quatFromEuler(t2.rot);
    const r2=read([t2]), m2=S.meshStats(S.weld(r2.e.bodies[0].pieces)), same2=t2.features.map(S.featureKey).join('\n')===r2.st.objects[0].features.map(S.featureKey).join('\n');
    ok(m2.open===0&&r2.t1===r2.t2&&same2&&Math.abs(m2.volume-ms.volume)<1,`the same sphere turned 30°, 20°, 10°: the features turn with it (same volume ${m2.volume.toFixed(1)}), the file and the objects come back the same`); }
  // a cylinder: domes over the rim
  { const cyl={id:1,kind:'cyl',name:'',size:[36,40],p:[0,0,20],rot:[0,0,0],edge:{rule:'spline',t:6,k:0.8,keys:['top','bottom']},
      features:[F('top',[0,0],{kind:'boss',R:8,h:4,k:1}),F('top',[0,0],{kind:'dome',R:2.5,h:1.5,k:0.45},{pattern:{lattice:{type:'polar',n:10,rad:14,phase:0},region:{type:'all'},blend:null}})]};
    const r=read([cyl]), B=r.e.bodies[0], m=S.weld(B.pieces), ms=S.meshStats(m);
    ok(!!B.skin&&ms.open===0&&out(m,B.body.c)===0&&r.t1===r.t2,`a cylinder with 10 domes on radius 14 over its rim (setback 6): skin closed, faces out, the file comes back the same`); }
  // the animation's grid: the edges soften from 1 to 20 mm under the features, which keep their place and size
  { const objs=[box([F('zp',[20,20],{kind:'boss',R:8,h:4,k:1}),F('yp',[20,20],{kind:'dome',R:2.5,h:-1,k:0.45},{pattern:{lattice:{type:'rect',a:[7,0],b:[3.5,6.062178]},region:{type:'all'},blend:null}})])];
    const r=read(objs), b={...r.rec.bodies[0],useFrozen:true}, fx=S.bodyInstances(b,[]), sk=S.makeSkin(b,0.05,[],fx.all,{anim:true}); const res=[];
    for(const t of [1,6,12,20]){ sk.update(t); const m=S.weld([{pos:sk.pos,idx:sk.idx}]), ms=S.meshStats(m); res.push([t,ms.open,out(m,b.c)]); }
    let tm=performance.now(); for(let k=0;k<10;k++) sk.update(1+k); tm=(performance.now()-tm)/10;
    ok(res.every(x=>x[1]===0&&x[2]===0),`animation grid (${sk.nv} points, ${fx.all.length} copies): closed and facing out at setbacks ${res.map(x=>x[0]).join(', ')} mm; ${tm.toFixed(1)} ms to move it`); }
}
// 8. speed of the demo at machine resolution
{ const d=S.parseSnark(globalThis.demoText); for(const ch of [0.05,0.001]){ const ev=S.evaluate(d,ch); console.log(`      demo at chord ${ch}: ${ev.bodies.reduce((s,b)=>s+b.tris,0)} triangles in ${ev.ms.toFixed(1)} ms`); } }
console.log(fails?`${fails} FAILED`:'ALL PASSED');
process.exitCode = fails ? 1 : 0;
