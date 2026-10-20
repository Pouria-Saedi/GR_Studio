const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const database = require('./database');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.GR_ADMIN_PASSWORD || '';
const LIVE_RELOAD = process.env.NODE_ENV !== 'production';
const reloadClients = new Set();
const sessions = new Map();
const loginAttempts = new Map();
const customerAttempts = new Map();
const signupAttempts = new Map();
fs.mkdirSync(DATA, { recursive: true });
const seed = [
  { id:'orbit', name:'Orbit no. 01', category:'Objects', collection:'Form studies', price:68, stock:7, status:'published', featured:true, description:'A small wooden object with a balanced form and warm natural finish, designed to invite a second look.', dimensions:'Small-scale form', materials:'Wood and complementary materials', color:'#c7955f', shape:'orbit', sku:'GR-OBJ-001' },
  { id:'little-echo', name:'Little Echo', category:'Instruments', collection:'Sound objects', price:54, stock:4, status:'published', featured:true, description:'A small instrument for curious hands, with a considered form and a warm, expressive presence.', dimensions:'Small-scale form', materials:'Wood and complementary materials', color:'#d8b783', shape:'echo', sku:'GR-INS-001' },
  { id:'arc-blocks', name:'Arc blocks', category:'Toys', collection:'Play forms', price:82, stock:9, status:'published', featured:true, description:'A set of sculptural forms for open-ended play, ready to be stacked, arranged, and reinvented.', dimensions:'Small-scale form', materials:'Wood and complementary materials', color:'#bd8055', shape:'blocks', sku:'GR-TOY-001' },
  { id:'tide-spinner', name:'Tide spinner', category:'Interactive', collection:'Small motions', price:42, stock:0, status:'published', featured:false, description:'A tactile object centered on a quiet, repeating movement. Turn it slowly and let the rhythm settle.', dimensions:'Small-scale form', materials:'Wood and complementary materials', color:'#d1a577', shape:'spinner', sku:'GR-INT-001' },
  { id:'seed-rattle', name:'Seed rattle', category:'Toys', collection:'Play forms', price:36, stock:12, status:'published', featured:false, description:'A playful sound object for little moments of discovery, shaped to be held and explored.', dimensions:'Small-scale form', materials:'Wood and complementary materials', color:'#daa971', shape:'rattle', sku:'GR-TOY-002' },
  { id:'column-vase', name:'Column study', category:'Objects', collection:'Form studies', price:74, stock:3, status:'published', featured:false, description:'A sculptural wooden form with a calm silhouette, made to bring a considered detail to a shelf.', dimensions:'Small-scale form', materials:'Wood and complementary materials', color:'#bf906b', shape:'column', sku:'GR-OBJ-002' }
];
function write(name, data) { if(name==='products.json')database.saveProducts(data);else if(name==='orders.json')database.saveOrders(data); }
const photoSeed = [
  {id:'orbit',name:'Wooden play set',category:'Toys',collection:'Play forms',image:'/source/products/wooden-play-set-01.png',images:['/source/products/wooden-play-set-01.png','/source/products/wooden-play-set-02.png','/source/products/wooden-play-set-03.png','/source/products/wooden-play-set-04.png','/source/products/wooden-play-set-05.png'],shape:'blocks',sku:'GR-TOY-001'},
  {id:'little-echo',name:'Miniature violin',category:'Instruments',collection:'Small instruments',image:'/source/products/miniature-violin-01.png',images:['/source/products/miniature-violin-01.png'],shape:'echo',sku:'GR-INS-001'},
  {id:'arc-blocks',name:'Wooden bowling set',category:'Toys',collection:'Play forms',image:'/source/products/wooden-bowling-set-01.png',images:['/source/products/wooden-bowling-set-01.png','/source/products/wooden-bowling-set-02.png','/source/products/wooden-bowling-set-03.png','/source/products/wooden-bowling-set-04.png'],shape:'blocks',sku:'GR-TOY-002'},
  {id:'tide-spinner',name:'Wooden play objects',category:'Toys',collection:'Play forms',image:'/source/products/wooden-play-objects-01.png',images:['/source/products/wooden-play-objects-01.png','/source/products/wooden-play-objects-02.png'],shape:'spinner',sku:'GR-TOY-003'},
  {id:'seed-rattle',name:'Wooden biplane',category:'Toys',collection:'Miniatures',image:'/source/products/wooden-biplane-01.png',images:['/source/products/wooden-biplane-01.png','/source/products/wooden-biplane-02.png','/source/products/wooden-biplane-03.png'],shape:'orbit',sku:'GR-TOY-004'},
  {id:'column-vase',name:'Mini chess set',category:'Objects',collection:'Miniatures',image:'/source/products/mini-chess-set-01.jpg',images:['/source/products/mini-chess-set-01.jpg'],shape:'column',sku:'GR-OBJ-001'},
  {id:'mini-sewing-machine',name:'Miniature sewing machine',category:'Objects',collection:'Miniatures',image:'/source/products/miniature-sewing-machine-01.jpg',images:['/source/products/miniature-sewing-machine-01.jpg'],shape:'column',sku:'GR-OBJ-002'},
  {id:'wooden-camper',name:'Wooden camper van',category:'Toys',collection:'Miniatures',image:'/source/products/wooden-camper-van-01.jpg',images:['/source/products/wooden-camper-van-01.jpg'],shape:'orbit',sku:'GR-TOY-005'},
  {id:'robot-keychain',name:'Robot keychain',category:'Accessories',collection:'Small things',image:'/source/products/robot-keychain-01.jpg',images:['/source/products/robot-keychain-01.jpg'],shape:'orbit',sku:'GR-ACC-001'},
  {id:'wooden-bangles',name:'Wooden bangles',category:'Wearables',collection:'Wearables',image:'/source/products/wooden-bangles-01.jpg',images:['/source/products/wooden-bangles-01.jpg'],shape:'orbit',sku:'GR-WEA-001'},
  {id:'pendant-necklace',name:'Wood pendant necklace',category:'Wearables',collection:'Wearables',image:'/source/products/wood-pendant-necklace-01.jpg',images:['/source/products/wood-pendant-necklace-01.jpg'],shape:'orbit',sku:'GR-WEA-002'},
  {id:'wood-necklace',name:'Wood necklace',category:'Wearables',collection:'Wearables',image:'/source/products/wood-necklace-01.jpg',images:['/source/products/wood-necklace-01.jpg'],shape:'orbit',sku:'GR-WEA-003'}
];
database.initialize(seed);
function products(){const ps=database.products();let changed=false;for(const sample of photoSeed){let p=ps.find(x=>x.id===sample.id);if(!p){p={...seed.find(x=>x.id==='arc-blocks'),...sample,price:48,stock:5,status:'published',featured:false,description:'A thoughtful piece from the GR Studio collection. Explore the images for a closer look and contact the studio for more detail.',dimensions:'Small-scale form',materials:'Wood and complementary materials',color:'#c7955f'};ps.push(p);changed=true;continue}if(!p.image){Object.assign(p,sample,{description:'A thoughtful piece from the GR Studio collection. Explore the images for a closer look and contact the studio for more detail.',dimensions:'Small-scale form',materials:'Wood and complementary materials'});changed=true}}if(changed)write('products.json',ps);return ps}
function orders(){return database.orders()}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.avif':'image/avif','.mp4':'video/mp4','.mov':'video/quicktime'};
function send(res,status,body,type='application/json; charset=utf-8',headers={}) {res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",...headers});res.end(type.startsWith('application/json')?JSON.stringify(body):body)}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>100000)reject(Error('too large'))});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch{reject(Error('invalid json'))}});req.on('error',reject)})}
function cookie(req,key){const part=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(key+'='));return part?decodeURIComponent(part.slice(key.length+1)):''}
function isAdmin(req){const token=cookie(req,'gr_admin');const exp=sessions.get(token);if(exp&&exp>Date.now())return true;if(token)sessions.delete(token);return false}
function adminOnly(req,res){if(isAdmin(req))return true;send(res,401,{error:'Administrator sign-in required.'});return false}
function customerAccount(req){const token=cookie(req,'gr_customer');if(!token)return null;return database.accountForSession(crypto.createHash('sha256').update(token).digest('hex'),new Date().toISOString())||null}
function consumeLimit(map,key,max,windowMs){const now=Date.now(),entry=map.get(key);if(!entry||entry.until<=now){map.set(key,{count:1,until:now+windowMs});return false}entry.count++;return entry.count>max}
function hashPassword(password,salt){return new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024},(error,derived)=>error?reject(error):resolve(derived.toString('hex'))))}
function customerSession(res,account){const token=crypto.randomBytes(32).toString('hex'),expires=new Date(Date.now()+30*24*60*60*1000).toISOString();database.createCustomerSession(crypto.createHash('sha256').update(token).digest('hex'),account.id,expires);return send(res,200,{ok:true,account:{id:account.id,email:account.email,name:account.name,createdAt:account.createdAt}},'application/json; charset=utf-8',{'Set-Cookie':`gr_customer=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.NODE_ENV==='production'?'; Secure':''}`})}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if (LIVE_RELOAD && req.method === 'GET' && url.pathname === '/__dev/events') {
    res.writeHead(200, {'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    res.write('retry: 1000\n\n');
    reloadClients.add(res);
    req.on('close', () => reloadClients.delete(res));
    return;
  }
  if (LIVE_RELOAD && req.method === 'GET' && url.pathname === '/__dev/live-reload.js') {
    res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    return fs.createReadStream(path.join(ROOT, 'dev-client.js')).pipe(res);
  }
  try {
    if(url.pathname.startsWith('/api/')){
      if(req.method==='GET'&&url.pathname==='/api/products')return send(res,200,products().filter(p=>p.status==='published'));
      if(req.method==='GET'&&url.pathname==='/api/account/me'){
        const account=customerAccount(req);if(!account)return send(res,200,{authenticated:false},'application/json; charset=utf-8',{'Cache-Control':'no-store'});
        return send(res,200,{authenticated:true,account,orders:database.accountOrders(account.id),addresses:database.accountAddresses(account.id)},'application/json; charset=utf-8',{'Cache-Control':'no-store'});
      }
      if(req.method==='POST'&&url.pathname==='/api/account/signup'){
        const ip=req.socket.remoteAddress||'unknown';if(consumeLimit(signupAttempts,ip,8,60*60*1000))return send(res,429,{error:'Too many signup attempts. Try again later.'});
        const b=await body(req),email=String(b.email||'').trim().toLowerCase(),name=String(b.name||'').trim(),password=String(b.password||'');
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return send(res,400,{error:'Enter a valid email address.'});
        if(!name||name.length>100)return send(res,400,{error:'Enter your name (up to 100 characters).'});
        if(password.length<10||password.length>128)return send(res,400,{error:'Choose a password between 10 and 128 characters.'});
        if(database.accountByEmail(email))return send(res,409,{error:'An account with this email already exists. Sign in instead.'});
        const salt=crypto.randomBytes(16).toString('hex'),account={id:crypto.randomUUID(),email,name,passwordSalt:salt,passwordHash:await hashPassword(password,salt),createdAt:new Date().toISOString()};
        try{database.createAccount(account)}catch{return send(res,409,{error:'An account with this email already exists. Sign in instead.'})}
        return customerSession(res,account);
      }
      if(req.method==='POST'&&url.pathname==='/api/account/login'){
        const ip=req.socket.remoteAddress||'unknown';if(consumeLimit(customerAttempts,ip,5,15*60*1000))return send(res,429,{error:'Too many sign-in attempts. Try again in 15 minutes.'});
        const b=await body(req),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||''),account=database.accountByEmail(email);
        const salt=account?.passwordSalt||crypto.randomBytes(16).toString('hex'),supplied=Buffer.from(await hashPassword(password,salt),'hex');
        const expected=Buffer.from(account?.passwordHash||crypto.randomBytes(64).toString('hex'),'hex');
        const matches=crypto.timingSafeEqual(supplied,expected);if(!account||!matches)return send(res,401,{error:'Email or password did not match.'});
        customerAttempts.delete(ip);return customerSession(res,account);
      }
      if(req.method==='POST'&&url.pathname==='/api/account/logout'){
        const token=cookie(req,'gr_customer');if(token)database.deleteCustomerSession(crypto.createHash('sha256').update(token).digest('hex'));
        return send(res,200,{ok:true},'application/json; charset=utf-8',{'Set-Cookie':'gr_customer=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});
      }
      if(req.method==='PATCH'&&url.pathname==='/api/account/profile'){
        const account=customerAccount(req);if(!account)return send(res,401,{error:'Sign in to update your account.'});
        const b=await body(req),name=String(b.name||'').trim();if(!name||name.length>100)return send(res,400,{error:'Enter your name (up to 100 characters).'});
        database.updateAccountName(account.id,name);return send(res,200,{ok:true,name});
      }
      if(req.method==='POST'&&url.pathname==='/api/account/password'){
        const account=customerAccount(req);if(!account)return send(res,401,{error:'Sign in to change your password.'});
        const b=await body(req),current=String(b.currentPassword||''),next=String(b.newPassword||''),stored=database.accountByEmail(account.email);
        if(next.length<10||next.length>128)return send(res,400,{error:'Choose a new password between 10 and 128 characters.'});
        const currentHash=Buffer.from(await hashPassword(current,stored.passwordSalt),'hex'),passwordHash=Buffer.from(stored.passwordHash,'hex');
        if(!crypto.timingSafeEqual(currentHash,passwordHash))return send(res,401,{error:'Your current password did not match.'});
        const salt=crypto.randomBytes(16).toString('hex');database.updateAccountPassword(account.id,await hashPassword(next,salt),salt);return send(res,200,{ok:true});
      }
      if(url.pathname==='/api/account/addresses'||url.pathname.startsWith('/api/account/addresses/')){
        const account=customerAccount(req);if(!account)return send(res,401,{error:'Sign in to manage saved addresses.'});
        const match=url.pathname.match(/^\/api\/account\/addresses(?:\/([\w-]+))?(?:\/(default))?$/);
        if(!match)return send(res,404,{error:'No such address endpoint.'});
        const id=match[1],makeDefault=match[2]==='default';
        if(req.method==='POST'&&!id){const b=await body(req),label=String(b.label||'Home').trim(),fullName=String(b.fullName||'').trim(),line1=String(b.line1||'').trim(),city=String(b.city||'').trim(),postalCode=String(b.postalCode||'').trim(),country=String(b.country||'').trim();if(!fullName||!line1||!city||!postalCode||!country)return send(res,400,{error:'Complete the name and required address fields.'});if([label,fullName,line1,String(b.line2||''),city,String(b.region||''),postalCode,country].some((v,i)=>v.length>[40,100,150,150,80,80,30,80][i]))return send(res,400,{error:'One or more address fields are too long.'});const address=database.saveAccountAddress({id:crypto.randomUUID(),accountId:account.id,label,fullName,line1,line2:String(b.line2||'').trim(),city,region:String(b.region||'').trim(),postalCode,country,isDefault:b.isDefault===true,now:new Date().toISOString()});return send(res,201,address)}
        if(req.method==='PATCH'&&id&&makeDefault){if(!database.setDefaultAccountAddress(id,account.id))return send(res,404,{error:'Address not found.'});return send(res,200,{ok:true})}
        if(req.method==='PATCH'&&id&&!makeDefault){const b=await body(req),prior=database.accountAddress(id,account.id);if(!prior)return send(res,404,{error:'Address not found.'});const label=String(b.label||'Home').trim(),fullName=String(b.fullName||'').trim(),line1=String(b.line1||'').trim(),city=String(b.city||'').trim(),postalCode=String(b.postalCode||'').trim(),country=String(b.country||'').trim();if(!fullName||!line1||!city||!postalCode||!country)return send(res,400,{error:'Complete the name and required address fields.'});if([label,fullName,line1,String(b.line2||''),city,String(b.region||''),postalCode,country].some((v,i)=>v.length>[40,100,150,150,80,80,30,80][i]))return send(res,400,{error:'One or more address fields are too long.'});return send(res,200,database.saveAccountAddress({id,accountId:account.id,label,fullName,line1,line2:String(b.line2||'').trim(),city,region:String(b.region||'').trim(),postalCode,country,isDefault:b.isDefault===true||prior.isDefault,now:new Date().toISOString()}))}
        if(req.method==='DELETE'&&id&&!makeDefault){if(!database.deleteAccountAddress(id,account.id))return send(res,404,{error:'Address not found.'});return send(res,200,{ok:true})}
        return send(res,404,{error:'No such address endpoint.'});
      }
      if(req.method==='POST'&&url.pathname==='/api/newsletter'){
        const b=await body(req),email=String(b.email||'').trim().toLowerCase();
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return send(res,400,{error:'Enter a valid email address.'});
        if(b.consent!==true)return send(res,400,{error:'Please confirm you would like to receive studio emails.'});
        database.subscribe(email,crypto.randomUUID(),new Date().toISOString());
        return send(res,200,{ok:true,message:'You’re on the list. Thanks for joining us.'});
      }
      if(req.method==='GET'&&url.pathname==='/api/admin/status')return send(res,200,{configured:!!ADMIN_PASSWORD,authenticated:isAdmin(req)});
      if(req.method==='POST'&&url.pathname==='/api/admin/login'){
        if(!ADMIN_PASSWORD)return send(res,503,{error:'Admin access is not configured. Set GR_ADMIN_PASSWORD and restart the server.'});
        const ip=req.socket.remoteAddress||'unknown', attempts=loginAttempts.get(ip)||{count:0,until:0};
        if(attempts.until>Date.now())return send(res,429,{error:'Too many attempts. Try again in 15 minutes.'});
        const b=await body(req);const supplied=String(b.password||'');
        const a=Buffer.from(crypto.createHash('sha256').update(supplied).digest());const expected=Buffer.from(crypto.createHash('sha256').update(ADMIN_PASSWORD).digest());
        if(!crypto.timingSafeEqual(a,expected)){attempts.count++;if(attempts.count>=5){attempts.count=0;attempts.until=Date.now()+900000}loginAttempts.set(ip,attempts);return send(res,401,{error:'That password did not match.'})}
        loginAttempts.delete(ip);const token=crypto.randomBytes(32).toString('hex');sessions.set(token,Date.now()+8*60*60*1000);
        return send(res,200,{ok:true},'application/json; charset=utf-8',{'Set-Cookie':`gr_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV==='production'?'; Secure':''}`});
      }
      if(req.method==='POST'&&url.pathname==='/api/admin/logout'){const token=cookie(req,'gr_admin');sessions.delete(token);return send(res,200,{ok:true},'application/json; charset=utf-8',{'Set-Cookie':'gr_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'})}
      if(url.pathname.startsWith('/api/admin/')){
        if(!adminOnly(req,res))return;
        if(req.method==='GET'&&url.pathname==='/api/admin/products')return send(res,200,products());
        if(req.method==='GET'&&url.pathname==='/api/admin/signups')return send(res,200,database.subscribers());
        const signupMatch=url.pathname.match(/^\/api\/admin\/signups\/([\w-]+)$/);
        if(req.method==='PATCH'&&signupMatch){const b=await body(req);if(!['subscribed','unsubscribed'].includes(b.status))return send(res,400,{error:'Choose a valid signup status.'});const changed=database.setSubscriberStatus(signupMatch[1],b.status,new Date().toISOString());if(!changed)return send(res,404,{error:'Signup not found.'});return send(res,200,{ok:true})}
        if(req.method==='POST'&&url.pathname==='/api/admin/products') {const b=await body(req);const ps=products();const id=(b.name||'new-product').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+crypto.randomBytes(2).toString('hex');const p={id,name:String(b.name||'New product').slice(0,100),category:String(b.category||'Objects').slice(0,40),collection:String(b.collection||'New collection').slice(0,60),price:Math.max(0,Number(b.price)||0),salePrice:null,stock:Math.max(0,Math.floor(Number(b.stock)||0)),status:'draft',featured:false,description:String(b.description||'').slice(0,1500),dimensions:'Small-scale form',materials:'Wood and complementary materials',color:'#c7955f',shape:'orbit',sku:String(b.sku||'').slice(0,50)};ps.push(p);write('products.json',ps);return send(res,201,p)}
        const productMatch=url.pathname.match(/^\/api\/admin\/products\/([\w-]+)$/);
        if(req.method==='PATCH'&&productMatch){const b=await body(req),ps=products(),i=ps.findIndex(p=>p.id===productMatch[1]);if(i<0)return send(res,404,{error:'Product not found.'});for(const k of ['name','category','collection','description','sku'])if(b[k]!==undefined)ps[i][k]=String(b[k]).slice(0,k==='description'?1500:100);for(const k of ['price','stock'])if(b[k]!==undefined)ps[i][k]=Math.max(0,k==='stock'?Math.floor(Number(b[k])||0):Number(b[k])||0);if(b.salePrice!==undefined){const sale=b.salePrice===''||b.salePrice===null?null:Number(b.salePrice);if(sale!==null&&(!Number.isFinite(sale)||sale<=0||sale>=ps[i].price))return send(res,400,{error:'Sale price must be greater than zero and below the regular price.'});ps[i].salePrice=sale}if(b.status!==undefined&&['draft','published','archived'].includes(b.status))ps[i].status=b.status;if(b.featured!==undefined)ps[i].featured=!!b.featured;write('products.json',ps);return send(res,200,ps[i])}
        if(req.method==='GET'&&url.pathname==='/api/admin/orders')return send(res,200,orders());
        const orderMatch=url.pathname.match(/^\/api\/admin\/orders\/([\w-]+)$/);
        if(req.method==='PATCH'&&orderMatch){const b=await body(req),os=orders(),o=os.find(x=>x.id===orderMatch[1]);if(!o)return send(res,404,{error:'Order not found.'});if(['pending','processing','fulfilled','cancelled'].includes(b.fulfillment))o.fulfillment=b.fulfillment;if(b.tracking!==undefined)o.tracking=String(b.tracking).slice(0,100);write('orders.json',os);return send(res,200,o)}
        return send(res,404,{error:'No such admin endpoint.'});
      }
      if(req.method==='POST'&&url.pathname==='/api/orders'){
        const b=await body(req);if(!b.customer||!b.customer.email||!b.customer.name||!b.address||!b.address.country)return send(res,400,{error:'Please complete your contact and shipping details.'});
        const signedIn=customerAccount(req);if(signedIn&&String(b.customer.email).trim().toLowerCase()!==signedIn.email)return send(res,400,{error:'Use the email address linked to your signed-in account.'});
        const ps=products(),items=[];for(const line of (Array.isArray(b.items)?b.items:[])){const p=ps.find(x=>x.id===line.id&&x.status==='published');const qty=Math.max(1,Math.min(20,Math.floor(Number(line.quantity)||1)));if(!p||p.stock<qty)return send(res,409,{error:`${p?.name||'A product'} is no longer available in that quantity.`});const price=p.salePrice&&p.salePrice<p.price?p.salePrice:p.price;items.push({id:p.id,name:p.name,price,quantity:qty,lineTotal:price*qty})}if(!items.length)return send(res,400,{error:'Your bag is empty.'});
        for(const it of items)ps.find(p=>p.id===it.id).stock-=it.quantity;
        const subtotal=items.reduce((n,x)=>n+x.lineTotal,0),order={id:'GR-'+Date.now().toString(36).toUpperCase(),createdAt:new Date().toISOString(),accountId:signedIn?.id||null,customer:{name:String(b.customer.name).slice(0,100),email:String(b.customer.email).slice(0,180)},address:{line1:String(b.address.line1||'').slice(0,150),line2:String(b.address.line2||'').slice(0,150),city:String(b.address.city||'').slice(0,80),region:String(b.address.region||'').slice(0,80),postalCode:String(b.address.postalCode||'').slice(0,30),country:String(b.address.country).slice(0,80)},items,subtotal,shipping:0,total:subtotal,paymentStatus:'unpaid',fulfillment:'pending',tracking:''};database.createOrder(order,ps);return send(res,201,{id:order.id,paymentStatus:order.paymentStatus,note:'Order saved as unpaid. Payment is not available.'});
      }
      return send(res,404,{error:'No such endpoint.'});
    }
    if(req.method!=='GET')return send(res,405,{error:'Method not allowed.'});
    const pathname=decodeURIComponent(url.pathname);
    if(pathname.startsWith('/payments/')){const file=path.basename(pathname);const allowed=new Set(['apple-pay.svg','google-pay.svg','bancontact.svg','ideal.svg','klarna.svg','mastercard.svg','maestro.svg','paypal.svg','visa.svg','american-express.svg']);if(!allowed.has(file))return send(res,404,'Not found','text/plain; charset=utf-8');const assetPath=path.join(ROOT,'assets','payments',file);if(!fs.existsSync(assetPath))return send(res,404,'Not found','text/plain; charset=utf-8');res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"});return fs.createReadStream(assetPath).pipe(res)}
    if(pathname.startsWith('/source/')){const sourceRoot=path.resolve(ROOT,'Source');const sourceFile=path.resolve(sourceRoot,pathname.slice('/source/'.length));if(!sourceFile.startsWith(sourceRoot+path.sep)||!fs.existsSync(sourceFile)||!fs.statSync(sourceFile).isFile())return send(res,404,'Not found','text/plain; charset=utf-8');const type=mime[path.extname(sourceFile).toLowerCase()]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"});return fs.createReadStream(sourceFile).pipe(res)}
    const asset=['/index.html','/app.js','/styles.css','/mark.svg'].includes(pathname);const file=asset?path.basename(pathname):'index.html';const full=path.join(ROOT,file);if(!fs.existsSync(full)||!fs.statSync(full).isFile())return send(res,404,'Not found','text/plain; charset=utf-8');const type=mime[path.extname(full)]||'application/octet-stream';const liveHtml=LIVE_RELOAD&&file==='index.html'?fs.readFileSync(full,'utf8').replace('</body>','<script src="/__dev/live-reload.js" defer></script></body>'):null;res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"});if(liveHtml!==null)return res.end(liveHtml);fs.createReadStream(full).pipe(res);
  }catch(e){if(!res.headersSent)send(res,e.message==='invalid json'?400:500,{error:e.message==='invalid json'?'Please send valid information.':'The request could not be completed.'})}
});
if (LIVE_RELOAD) {
  let watchTimer;
  try {
    fs.watch(ROOT, { recursive: true }, (_event, filename) => {
      const rel = String(filename || '').replace(/\\/g, '/');
      if (!rel || /^(?:\.git|\.vscode|data|node_modules)(?:\/|$)/i.test(rel)) return;
      if (!/\.(?:html|js|css|svg|json|png|jpe?g|avif|webp|gif|woff2?|ttf)$/i.test(rel) || rel === 'server.js') return;
      clearTimeout(watchTimer);
      watchTimer = setTimeout(() => {
        const payload = JSON.stringify({ path: rel });
        for (const client of reloadClients) client.write(`data: ${payload}\n\n`);
      }, 120);
    });
  } catch (error) {
    console.warn('Live reload file watcher unavailable:', error.message);
  }
}
server.listen(PORT,()=>console.log(`GR Studio storefront ready at http://localhost:${PORT}${ADMIN_PASSWORD?'':' (admin disabled: set GR_ADMIN_PASSWORD)'}`));
