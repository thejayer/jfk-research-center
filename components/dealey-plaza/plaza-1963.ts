import * as THREE from "three";

export { PLAZA_VIEWS, type PlazaView } from "./plaza-1963-views";

// Feet, Houston/Main = (0,0); +X east, +Z south, Y up.
// CE877 supplies widths/heights/overall fall. Plan outlines and detailing are
// visual estimates from CE876/882 and period photographs, not survey tracing.
export const grade = (x: number) => Math.min(0, Math.max(-24, x * 24 / 425));
const lawnHeight=(x:number,z:number)=>{
  const streetCenter=250-Math.min(190,Math.max(0,-x*.5));
  const shoulder=Math.max(0,Math.min(1,(Math.abs(z)-streetCenter-30)/18));
  const rise=x < -115 ? shoulder*12*Math.exp(-((x+260)**2/14000+(Math.abs(z)-240)**2/5000)) : 0;
  return grade(x)+rise;
};

export function legacyToPlaza(p: { x: number; y: number; z: number }) {
  const x = p.x + 48, z = p.z - 36;
  // Rigid orientation only, preserving feet and ray lengths. These legacy
  // anchors are NOT calibrated to the reconstructed streets or window bays.
  return new THREE.Vector3(-25 - .9396926 * x + .3420201 * z, p.y,
    -273 - .3420201 * x - .9396926 * z);
}

export function buildPlaza1963(scene: THREE.Scene) {
  // Authored masonry pattern with deterministic variation; no image asset.
  const brickCanvas=document.createElement("canvas");brickCanvas.width=256;brickCanvas.height=256;
  const brickContext=brickCanvas.getContext("2d")!;brickContext.fillStyle="#b2aa98";brickContext.fillRect(0,0,256,256);
  for(let row=0;row<16;row++)for(let col=-1;col<9;col++){
    const shade=176+((row*13+col*7+73)%29);
    brickContext.fillStyle=`rgb(${shade},${shade-5},${shade-13})`;
    brickContext.fillRect(col*32+(row%2)*16,row*16+1,31,14);
  }
  const brickTexture=new THREE.CanvasTexture(brickCanvas);brickTexture.colorSpace=THREE.SRGBColorSpace;
  brickTexture.wrapS=brickTexture.wrapT=THREE.RepeatWrapping;brickTexture.repeat.set(18,18);
  const materials = new Map<number, THREE.MeshStandardMaterial>();
  const mat = (color: number) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .9 }));
    return materials.get(color)!;
  };
  const box = (x:number,y:number,z:number,w:number,h:number,d:number,color:number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color));
    m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; scene.add(m); return m;
  };
  const line = (points: THREE.Vector3[], color=0xa79e88) => scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({color})));
  const ribbon = (points: number[][], width: number, color: number, lift=.18) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,grade(x)+lift,z)));
    const vertices:number[]=[], indices:number[]=[];
    for(let i=0;i<=96;i++) {
      const p=curve.getPoint(i/96), t=curve.getTangent(i/96);
      p.y=grade(p.x)+lift;
      const n=new THREE.Vector3(-t.z,0,t.x).normalize().multiplyScalar(width/2);
      vertices.push(p.x+n.x,p.y,p.z+n.z,p.x-n.x,p.y,p.z-n.z);
      if(i<96){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide}));m.receiveShadow=true;scene.add(m);
    return curve;
  };
  // Sculpted lawn; local rises are interpretive, the overall fall is sourced.
  const terrain=new THREE.PlaneGeometry(780,850,100,100);terrain.rotateX(-Math.PI/2);
  const pos=terrain.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i)-185,z=pos.getZ(i);
    pos.setXYZ(i,x,lawnHeight(x,z)-.15,z);
  }
  terrain.computeVertexNormals();const lawn=new THREE.Mesh(terrain,mat(0x84916a));lawn.receiveShadow=true;scene.add(lawn);
  const elm=[[95,-250],[0,-250],[-85,-220],[-180,-157],[-295,-84],[-425,-60],[-530,-60]];
  const commerce=[[95,250],[0,250],[-85,220],[-180,157],[-295,84],[-425,60],[-530,60]];
  ribbon(elm.map(([x,z])=>[x,z-25]),10,0xc7c2ad,.3);
  ribbon(commerce.map(([x,z])=>[x,z+25]),10,0xc7c2ad,.3);
  ribbon([[-6,-400],[-6,400]],58,0xc8c3b0,.1);
  ribbon([[0,-400],[0,400]],40,0xa5a39a,.25);
  [elm,commerce,[[100,0],[-530,0]]].forEach(p=>ribbon(p,40,0xa8a69c));
  ribbon([[-25,-245],[-25,245]],10,0xcfcab5,.4);
  // Fine concrete joints and restrained white lane paint, no modern road Xs.
  [elm,commerce,[[0,0],[-530,0]]].forEach(p=>{
    const c=new THREE.CatmullRomCurve3(p.map(([x,z])=>new THREE.Vector3(x,grade(x)+.24,z)));
    const sample=(t:number)=>{const v=c.getPoint(t);v.y=grade(v.x)+.25;return v;};
    for(let i=4;i<92;i+=5) line([sample(i/96),sample((i+2)/96)],0xe8e2cd);
    for(let i=2;i<96;i+=4){const a=sample(i/96),t=c.getTangent(i/96),n=new THREE.Vector3(-t.z,0,t.x).multiplyScalar(19);line([a.clone().add(n),a.clone().sub(n)],0x97988c);}
  });
  // TSBD: sourced 100 ft square, 94 ft high; seven storeys with paired
  // sash windows, brick pilasters, limestone base and projecting cornice.
  const building=(x:number,z:number,w:number,d:number,h:number,color:number,cols:number,rows:number)=>{
    const foundationDepth=Math.max(0,-grade(x-w/2))+1;
    box(x,-foundationDepth/2,z,w,foundationDepth,d,0x9a9482);
    const walls=box(x,h/2,z,w,h,d,color);
    if(color===0x976747||color===0x79604d)walls.material=new THREE.MeshStandardMaterial({color,map:brickTexture,roughness:1});
    box(x,2,z,w+1,4,d+1,0xbeb39b);
    box(x,h-3,z,w+3,2,d+3,0xb5a18c);box(x,h,z,w+5,2,d+5,0x9c8b73);
    box(x,h+1.3,z,w-5,.6,d-5,0x726e62);
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const yy=9+row*(h-16)/rows, xx=x-w/2+(col+.5)*w/cols;
      for(const zz of [z-d/2-.12,z+d/2+.12]){
        box(xx,yy,zz,6.1,8.5,.3,0xd0bb99);box(xx,yy+.3,zz+(zz<z?-.2:.2),4.8,7,.2,0x354341);
        box(xx,yy,zz+(zz<z?-.35:.35),4.9,.35,.2,0xbaaa8d);box(xx,yy-4.3,zz,7,.55,1,0xc3b394);
      }
      const zz=z-d/2+(col+.5)*d/cols;
      for(const side of [-1,1]){
        box(x+side*(w/2+.12),yy,zz,.3,8.5,6.1,0xd0bb99);
        box(x+side*(w/2+.32),yy+.3,zz,.2,7,4.8,0x354341);
        box(x+side*(w/2+.45),yy,zz,.2,.35,4.9,0xbaaa8d);
      }
    }
  };
  building(-70,-325,100,100,94,0x976747,8,7);
  // Romanesque top-storey transoms; radii and trim are interpretive.
  for(let col=0;col<8;col++)for(const facing of ["south","east"]){
    for(const [radius,color,offset] of [[3.2,0xc2ad8d,0],[2.4,0x354341,.12]]){
      const arch=new THREE.Mesh(new THREE.CircleGeometry(radius,20,0,Math.PI),mat(color));
      if(facing==="south")arch.position.set(-120+(col+.5)*12.5,79.35,-274.5+offset);
      else {arch.position.set(-19.5+offset,79.35,-375+(col+.5)*12.5);arch.rotation.y=Math.PI/2;}
      scene.add(arch);
    }
  }
  box(-19.3,5,-325,.5,10,10,0xc6b799);box(-18.9,4.5,-325,.3,8,7,0x354341);
  // Brick pilasters and dentils break up otherwise flat walls.
  for(let i=0;i<=8;i++){
    box(-119+i*12.25,46,-274.5,1.5,82,1.2,0xa47755);
    box(-19.5,46,-374+i*12.25,1.2,82,1.5,0xa47755);
  }
  for(let i=0;i<25;i++) box(-119+i*4.1,90,-273.5,1.7,2,1.5,0xc1ab89);
  // Original simplified lettering for the documented rooftop rental billboard.
  // Support placement/size are visual estimates, not copied artwork.
  const signCanvas=document.createElement("canvas");signCanvas.width=512;signCanvas.height=128;
  const signContext=signCanvas.getContext("2d")!;signContext.fillStyle="#d2b85d";signContext.fillRect(0,0,512,128);
  signContext.fillStyle="#292c28";signContext.font="bold 65px sans-serif";signContext.textAlign="center";
  signContext.fillText("HERTZ",256,73);signContext.font="25px sans-serif";signContext.fillText("RENT A CAR",256,108);
  const signTexture=new THREE.CanvasTexture(signCanvas);signTexture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(43,11),new THREE.MeshBasicMaterial({map:signTexture,side:THREE.DoubleSide}));
  sign.position.set(-51,108,-290);sign.rotation.y=-Math.PI/4;scene.add(sign);
  for(const x of [-66,-38])box(x,99,-292,.7,11,.7,0x60665e);
  building(90,-325,104,104,110,0x79604d,8,8); // Dal-Tex massing
  building(91,-135,105,112,93,0xb7ad95,8,7); // Records
  building(96,25,115,104,124,0xb9ab91,8,9); // Criminal Courts
  building(-70,335,170,100,114,0xc9bd9f,12,8); // Post Office
  // Old courthouse: red sandstone mass and steep corner turrets.
  building(105,205,110,95,73,0x9f654d,7,5);
  for(const x of [54,156])for(const z of [160,250]){
    box(x,47,z,15,94,15,0xa36d52);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(13,29,4),mat(0x536866));roof.position.set(x,108,z);roof.rotation.y=Math.PI/4;scene.add(roof);
  }
  // Open 1963 courthouse annex steel frame, rather than its later facade.
  for(let y=8;y<179;y+=16){box(195,y,230,68,1.2,68,0x74716a);for(const x of [163,195,227])for(const z of [198,230,262])box(x,y+8,z,1.2,16,1.2,0x666b68);}
  // Pergolas: curved concrete colonnades, open roof beams and end shelters.
  for(const side of [-1,1]){
    const pts:number[][]=[];
    for(let i=0;i<=18;i++){
      const a=-.85+i/18*1.7,x=-242+Math.cos(a)*22,z=side*(190+Math.sin(a)*44);
      pts.push([x,z]);const base=grade(x)+7;
      if(i%2===0){box(x,base+6,z,2.4,12,2.4,0xd6cfb8);box(x,base+12.5,z,12,1.1,2.2,0xded7c1);}
      if(i>0){const prev=pts[i-1];const len=Math.hypot(x-prev[0],z-prev[1]);const beam=box((x+prev[0])/2,base+12,z/2+prev[1]/2,2,1.5,len+1,0xded7c1);beam.rotation.y=Math.atan2(x-prev[0],z-prev[1]);}
    }
    ribbon(pts,16,0xcac4ae,7);
    for(const end of [0,18]){const [x,z]=pts[end];box(x,grade(x)+20,z,19,2,19,0xdad3bd);for(const a of [-7,7])for(const b of [-7,7])box(x+a,grade(x)+13,z+b,2.5,13,2.5,0xd2cbb6);}
    // Broad steps down toward the street.
    for(let i=0;i<7;i++)box(-205+i*2,grade(-205)+5-i*.75,side*180,3,1,23,0xcac5b3);
    // Eastern peristyles and reflecting pools.
    ribbon([[-48,side*50],[-48,side*210]],15,0xc9c3ac,.4);
    box(-72,grade(-72)+.5,side*125,20,1,100,0xc9c3ad);
    box(-72,grade(-72)+1.05,side*125,15,.15,94,0x5d827f);
    for(let i=0;i<6;i++)box(-44,grade(-44)+7,side*(65+i*24),2.5,14,2.5,0xded6bd);
    box(-44,grade(-44)+14.5,side*125,5,2,140,0xded6bd);
    box(-110,grade(-110)+9,side*175,6,18,6,0xd8ceb4);
  }
  // Stockade, behind the north pergola; pickets, not chain link.
  for(let i=0;i<98;i++){
    const x=-360+i*1.65,z=-245-i*.12;
    box(x,lawnHeight(x,z)+4,z,1.5,8,.5,0x877359);
  }
  // Triple underpass: three independent open spans and concrete abutments.
  box(-440,3,-1,32,7,237,0xaaa696);
  for(const z of [-116,-30,30,116])box(-440,-10,z,32,22,13,0x969687);
  for(const z of [-118,118])box(-440,9,z,33,5,2,0xb9b4a0);
  for(let track=0;track<4;track++){
    const x=-451+track*7;
    for(let z=-280;z<=280;z+=5)box(x,7.1,z,6,.6,1.2,0x655c4d);
    for(const dx of [-2,2])box(x+dx,7.8,0,.3,.6,565,0x666965);
  }
  // Sparse autumn canopy: positions, species and density are approximate.
  const tree=(x:number,z:number,r:number)=>{
    const y=lawnHeight(x,z);
    box(x,y+10,z,1.6,20,1.6,0x665743);
    for(let k=0;k<3;k++){
      const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(r,2),mat([0x657851,0x7a8052,0x697953][k]));
      crown.position.set(x+(k-1)*r*.4,y+21+k*2,z+(k%2)*r*.5);crown.scale.y=.85;crown.castShadow=true;scene.add(crown);
    }
  };
  [[-125,-275,16],[-170,-275,17],[-280,-280,20],[-330,-280,17],[-355,-150,18],[-130,160,13],[-185,230,16],[-305,210,19],[-370,180,14],[-25,210,10]].forEach(([x,z,r])=>tree(x,z,r));
  // Lamps in sidewalk edge positions (not the later grass relocation).
  for(const side of [-1,1])for(const x of [-90,-188,-310]){
    const z=side*(x===-90?245:x===-188?180:110),y=grade(x);
    box(x,y+13,z,.45,26,.45,0x68736b);box(x+3,y+26,z,6,.5,.5,0x68736b);box(x+6,y+25.5,z,3,.8,1.6,0xe1d9bd);
  }
  // Small period sedans in the rail yard, contextual rather than identified cars.
  for(let i=0;i<7;i++){
    const x=-175-i*24,z=-370,y=lawnHeight(x,z)+2.6;
    box(x,y,z,15,3.4,6,[0x263a39,0xd4c4a4,0x756d60][i%3]);box(x,y+2.3,z,8,2.7,5,0x71807e);
    for(const dx of [-4.5,4.5])for(const dz of [-3,3])box(x+dx,y-1.5,z+dz,2.3,2.3,.7,0x303431);
  }
  // Original canvas lettering, no downloaded textures or photographic assets.
  const label=(text:string,x:number,y:number,z:number,size=15)=>{
    const c=document.createElement("canvas");c.width=768;c.height=96;const ctx=c.getContext("2d")!;
    ctx.fillStyle="rgba(248,244,225,.92)";ctx.fillRect(0,0,768,96);ctx.fillStyle="#303e38";ctx.font="500 40px Georgia";ctx.textAlign="center";ctx.fillText(text,384,61);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,toneMapped:false}));sprite.position.set(x,y,z);sprite.scale.set(size*8,size,1);sprite.userData.label=true;scene.add(sprite);
  };
  label("TEXAS SCHOOL BOOK DEPOSITORY",-75,120,-325,10);
  label("ELM STREET",-145,2,-165,8);label("MAIN STREET",-170,-4,0,8);label("COMMERCE STREET",-155,2,165,8);
  label("TRIPLE UNDERPASS",-440,27,0,9);label("NORTH PERGOLA · STOCKADE",-280,29,-245,9);
  label("N ↑",-380,2,-360,8);
  return { setLabels: (visible:boolean)=>scene.traverse(o=>{if(o.userData.label)o.visible=visible;}) };
}
