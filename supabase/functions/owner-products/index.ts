import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-owner-code','Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS'};
const reply = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  const expected=Deno.env.get('OWNER_ACCESS_CODE')||'';
  if(!expected || req.headers.get('x-owner-code')!==expected) return reply({error:'رمز المالك غير صحيح.'},401);
  const url=Deno.env.get('SUPABASE_URL')||''; const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  if(!url||!key) return reply({error:'إعدادات الخادم ناقصة.'},500);
  const db=createClient(url,key);
  try {
    if(req.method==='GET') return reply({ok:true});
    if(req.method==='POST') {
      const form=await req.formData(); const id=String(form.get('id')||''); const name=String(form.get('name')||'').trim(); const description=String(form.get('description')||'').trim(); const price=Number(form.get('price'));
      if(!name||name.length>120||!Number.isFinite(price)||price<0||description.length>3000) return reply({error:'تحقق من الاسم والسعر والوصف.'},400);
      const files=form.getAll('images').filter((v):v is File=>v instanceof File && v.size>0);
      if(files.length>10) return reply({error:'الحد الأقصى 10 صور.'},400);
      for(const f of files){if(!['image/jpeg','image/png','image/webp'].includes(f.type))return reply({error:'نوع صورة غير مدعوم.'},400);if(f.size>5*1024*1024)return reply({error:'حجم الصورة أكبر من 5MB.'},400);}
      let imageUrls:string[]=[];
      if(id && files.length===0){const {data:old,error}=await db.from('products').select('image_urls,image_url').eq('id',id).single();if(error)return reply({error:'المنتج غير موجود.'},404);imageUrls=Array.isArray(old.image_urls)&&old.image_urls.length?old.image_urls:(old.image_url?[old.image_url]:[]);}
      for(const f of files){const ext=f.type==='image/png'?'png':f.type==='image/webp'?'webp':'jpg';const path=`${crypto.randomUUID()}.${ext}`;const {error}=await db.storage.from('products').upload(path,f,{contentType:f.type,upsert:false});if(error)throw error;const {data}=db.storage.from('products').getPublicUrl(path);imageUrls.push(data.publicUrl);}
      const record={name,description,price,image_urls:imageUrls,image_url:imageUrls[0]||null,published:true,updated_at:new Date().toISOString()};
      const result=id?await db.from('products').update(record).eq('id',id).select().single():await db.from('products').insert(record).select().single();
      if(result.error)throw result.error;
      return reply({ok:true,product:result.data});
    }
    if(req.method==='DELETE') {const body=await req.json();if(!body?.id)return reply({error:'معرّف المنتج ناقص.'},400);const {error}=await db.from('products').delete().eq('id',body.id);if(error)throw error;return reply({ok:true});}
    return reply({error:'الطريقة غير مدعومة.'},405);
  } catch(e) {console.error(e);return reply({error:e?.message||'حدث خطأ في الخادم.'},500);}
});
