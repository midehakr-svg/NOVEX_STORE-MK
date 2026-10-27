(() => {
  const cfg = window.NOVEX_CONFIG || {}, $ = id => document.getElementById(id);
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && cfg.OWNER_FUNCTION_URL && !cfg.SUPABASE_ANON_KEY.includes('PASTE_') && !cfg.OWNER_FUNCTION_URL.includes('PASTE_');
  if (!configured || !window.supabase) { $('login-message').textContent = 'أكمل إعداد Supabase وميزة owner-products حسب README_AR.md.'; $('login-message').classList.add('error'); return; }
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const money = n => new Intl.NumberFormat('ar-DZ').format(Number(n || 0)) + ' دج';
  let ownerCode = '', editingImages = [];
  function message(id, text, error=false) { $(id).textContent = text; $(id).classList.toggle('error', error); }
  function setOpen(open) { $('login-panel').classList.toggle('hidden', open); $('dashboard').classList.toggle('hidden', !open); }
  async function ownerRequest(method, body) {
    const response = await fetch(cfg.OWNER_FUNCTION_URL, {method, headers:{'x-owner-code':ownerCode, 'apikey':cfg.SUPABASE_ANON_KEY, 'Authorization':'Bearer '+cfg.SUPABASE_ANON_KEY, ...(body instanceof FormData ? {} : {'Content-Type':'application/json'})}, body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined});
    const result = await response.json().catch(()=>({error:'رد غير مفهوم من الخادم'}));
    if (!response.ok) throw new Error(result.error || 'فشل الطلب');
    return result;
  }
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault(); ownerCode = $('owner-code').value;
    message('login-message','جارٍ التحقق من رمز المالك…');
    try { await ownerRequest('GET'); setOpen(true); $('owner-code').value=''; await loadProducts(); }
    catch(err) { ownerCode=''; message('login-message', 'تعذّر فتح لوحة المالك: '+err.message, true); }
  });
  $('logout').addEventListener('click', () => { ownerCode=''; setOpen(false); resetForm(); });
  $('cancel-edit').addEventListener('click', resetForm);
  $('product-images').addEventListener('change', previewImages);
  $('product-form').addEventListener('submit', saveProduct);
  function previewImages(){ const wrap=$('image-preview'); wrap.replaceChildren(); const files=[...$('product-images').files]; if(files.length>10){message('form-message','اختر 10 صور كحد أقصى.',true);$('product-images').value='';return;} files.forEach(f=>{const img=document.createElement('img');img.alt=f.name;img.src=URL.createObjectURL(f);wrap.append(img);}); }
  function resetForm(){ $('product-form').reset();$('product-id').value='';editingImages=[];$('image-preview').replaceChildren();$('form-title').textContent='إضافة منتج جديد';$('save-product').textContent='حفظ المنتج';$('cancel-edit').classList.add('hidden');message('form-message',''); }
  async function saveProduct(e){
    e.preventDefault(); const name=$('product-name').value.trim(), price=Number($('product-price').value), files=[...$('product-images').files];
    if(!name||!Number.isFinite(price)||price<0){message('form-message','أدخل اسمًا وسعرًا صحيحين.',true);return;}
    if(files.length>10){message('form-message','الحد الأقصى 10 صور.',true);return;}
    for(const f of files){if(!['image/jpeg','image/png','image/webp'].includes(f.type)){message('form-message','نوع إحدى الصور غير مدعوم.',true);return;}if(f.size>5*1024*1024){message('form-message','حجم إحدى الصور أكبر من 5MB.',true);return;}}
    const btn=$('save-product');btn.disabled=true;message('form-message','جارٍ حفظ المنتج والصور…');
    try{const fd=new FormData();fd.append('name',name);fd.append('price',String(price));fd.append('description',$('product-description').value.trim());if($('product-id').value)fd.append('id',$('product-id').value);files.forEach(f=>fd.append('images',f));await ownerRequest('POST',fd);resetForm();message('form-message','تم حفظ المنتج بنجاح.');await loadProducts();}
    catch(err){console.error(err);message('form-message','فشل الحفظ: '+err.message,true);}finally{btn.disabled=false;}
  }
  async function loadProducts(){
    const {data,error}=await db.from('products').select('*').eq('published',true).order('created_at',{ascending:false});
    const box=$('admin-products');box.replaceChildren();if(error){box.textContent='تعذر تحميل المنتجات: '+error.message;return;}if(!data?.length){box.textContent='لم تضف أي منتج بعد.';return;}
    data.forEach(p=>{const row=document.createElement('div');row.className='admin-product-row';const urls=Array.isArray(p.image_urls)&&p.image_urls.length?p.image_urls:[p.image_url].filter(Boolean);const img=document.createElement('img');img.src=urls[0]||'assets/product-placeholder.svg';img.alt='';const info=document.createElement('div');info.className='admin-product-info';const n=document.createElement('strong');n.textContent=p.name;const pr=document.createElement('span');pr.textContent=money(p.price);const st=document.createElement('small');st.textContent='منشور · '+urls.length+' صورة';info.append(n,pr,st);const actions=document.createElement('div');actions.className='row-actions';const edit=document.createElement('button');edit.className='secondary-btn';edit.textContent='تعديل';edit.addEventListener('click',()=>{$('product-id').value=p.id;$('product-name').value=p.name;$('product-price').value=p.price;$('product-description').value=p.description||'';editingImages=urls;$('form-title').textContent='تعديل المنتج';$('save-product').textContent='حفظ التعديلات';$('cancel-edit').classList.remove('hidden');$('image-preview').replaceChildren();urls.forEach(u=>{const im=document.createElement('img');im.src=u;im.alt='صورة حالية';$('image-preview').append(im);});window.scrollTo({top:0,behavior:'smooth'});});const del=document.createElement('button');del.className='danger-btn';del.textContent='حذف';del.addEventListener('click',async()=>{if(!confirm('هل تريد حذف هذا المنتج نهائياً؟'))return;try{await ownerRequest('DELETE',{id:p.id});await loadProducts();}catch(err){alert('تعذر الحذف: '+err.message);}});actions.append(edit,del);row.append(img,info,actions);box.append(row);});
  }
})();
