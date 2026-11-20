'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const state = {token:null, apiUrl:null, owner:null, repo:null, branch:'main', documents:[], incidents:[], editId:null, incidentEditId:null, busy:false};
  const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
  function alertMessage(message,type=''){const box=$('admin-alert');box.textContent=message;box.className='notice'+(type?' '+type:'');box.hidden=false;box.scrollIntoView({block:'nearest',behavior:'smooth'});}
  function hideAlert(){$('admin-alert').hidden=true;}
  function toggleBusy(busy){state.busy=busy;$('connect-btn').disabled=busy;$('save-document').disabled=busy;$('save-incident').disabled=busy;$('save-document').textContent=busy?'Guardando en GitHub...':(state.editId?'Guardar cambios':'Publicar procedimiento');$('save-incident').textContent=busy?'Guardando en GitHub...':(state.incidentEditId?'Guardar cambios':'Publicar registro');}
  function cleanBackendURL(url){
    const parsed=new URL(url);
    if(parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.search || parsed.hash)throw new Error('Ingresa una URL segura https:// de Cloudflare Workers.');
    return parsed.origin+parsed.pathname.replace(/\/$/,'');
  }
  async function request(url,options={}){
    const response=await fetch(url,{...options,headers:{'Accept':'application/json','Authorization':`Bearer ${state.token}`,...(options.headers||{})},cache:'no-store'});
    let json=null;try{json=await response.json();}catch(_){ }
    if(!response.ok){const detail=json?.message||`HTTP ${response.status}`;const e=new Error(detail);e.status=response.status;throw e;}
    return json;
  }
  function fromBase64(str){const binary=atob(str.replace(/\s/g,''));const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes);}
  function toBase64(bytes){let binary='';for(let i=0;i<bytes.length;i+=16384){binary+=String.fromCharCode(...bytes.subarray(i,i+16384));}return btoa(binary);}
  function pathUrl(path){return `${state.apiUrl}/file?path=${encodeURIComponent(path)}`;}
  async function getFile(path){
    try{return await request(pathUrl(path));}
    catch(e){if(e.status===404)return null;throw e;}
  }
  async function getCatalog(){
    const file=await getFile('data/catalogo.json');
    if(!file || !file.content)throw new Error('No se encuentra data/catalogo.json en la rama configurada en Cloudflare. Debes subir el paquete completo primero.');
    let data;try{data=JSON.parse(fromBase64(file.content));}catch(_){throw new Error('El catálogo tiene un formato JSON inválido.');}
    if(!Array.isArray(data.documentos))throw new Error('El catálogo no contiene una lista de documentos válida.');
    return {data,sha:file.sha};
  }
  async function getIncidents(){
    const file=await getFile('data/accidentabilidad.json');
    if(!file || !file.content)throw new Error('No se encuentra data/accidentabilidad.json. Sube el paquete actualizado y prueba nuevamente.');
    let data;try{data=JSON.parse(fromBase64(file.content));}catch(_){throw new Error('El registro de accidentabilidad tiene un JSON inválido.');}
    if(!Array.isArray(data.registros))throw new Error('La accidentabilidad no contiene una lista válida.');
    return {data,sha:file.sha};
  }
  async function saveIncidents(data,sha,commitMessage){
    data.actualizado=new Date().toISOString();
    await putFile('data/accidentabilidad.json',toBase64(new TextEncoder().encode(JSON.stringify(data,null,2)+'\n')),sha,commitMessage);
    state.incidents=data.registros;renderIncidentList();renderIncidentStats();
  }
  async function mutateIncidents(change,commitMessage){
    const {data,sha}=await getIncidents();
    const next=change(data.registros);
    if(!Array.isArray(next))throw new Error('No se pudo actualizar la lista de registros.');
    data.registros=next;
    await saveIncidents(data,sha,commitMessage);
  }
  async function putFile(path,base64,sha,commitMessage){
    return await request(pathUrl(path),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:commitMessage,content:base64,branch:state.branch,...(sha?{sha}:{})})});
  }
  async function saveCatalog(data,sha,commitMessage){
    data.actualizado=new Date().toISOString();
    await putFile('data/catalogo.json',toBase64(new TextEncoder().encode(JSON.stringify(data,null,2)+'\n')),sha,commitMessage);
    state.documents=data.documentos;renderAdminList();renderStats();
  }
  async function mutateCatalog(change,commitMessage){
    const {data,sha}=await getCatalog();
    const newDocuments=change(data.documentos);
    if(!Array.isArray(newDocuments))throw new Error('No se pudo actualizar la lista documental.');
    data.documentos=newDocuments;
    await saveCatalog(data,sha,commitMessage);
  }
  $('api-url').value=localStorage.getItem('esmAdminWorkerUrl')||'';
  $('connect-form').addEventListener('submit',async e=>{
    e.preventDefault();if(state.busy)return;hideAlert();
    const email=$('admin-email').value.trim();
    const password=$('admin-password').value;
    let apiUrl;
    try{apiUrl=cleanBackendURL($('api-url').value.trim());}
    catch(err){alertMessage(err.message,'error');return;}
    if(!email||!password){alertMessage('Ingresa el correo y contraseña del administrador.','error');return;}
    toggleBusy(true);
    try{
      const response=await fetch(`${apiUrl}/login`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({email,password}),cache:'no-store'});
      let data=null;try{data=await response.json();}catch(_){ }
      if(!response.ok)throw new Error(data?.message||'No se pudo iniciar sesión. Revisa el servidor y tus credenciales.');
      if(!data?.token || !data?.repo || !data?.owner || !data?.branch)throw new Error('El servidor de administración respondió incompletamente.');
      state.token=data.token;state.apiUrl=apiUrl;state.owner=data.owner;state.repo=data.repo;state.branch=data.branch;
      const catalog=await getCatalog();const incidentResult=await getIncidents();
      state.documents=catalog.data.documentos;state.incidents=incidentResult.data.registros;
      $('admin-password').value='';
      localStorage.setItem('esmAdminWorkerUrl',apiUrl); // Solo URL pública, nunca credenciales.
      $('connect-card').hidden=true;$('workspace').hidden=false;
      $('connected-repo').textContent=`${state.owner}/${state.repo} · ${state.branch}`;
      renderAdminList();renderStats();resetEditor();renderIncidentList();renderIncidentStats();resetIncidentEditor();
      alertMessage('Sesión iniciada. Ya puedes administrar ambos módulos.','success');
    }catch(err){state.token=null;alertMessage('No se pudo acceder: '+err.message,'error');}
    finally{toggleBusy(false);}
  });
  $('disconnect').addEventListener('click',()=>{
    state.token=null;state.documents=[];state.incidents=[];state.editId=null;state.incidentEditId=null;
    $('workspace').hidden=true;$('connect-card').hidden=false;$('admin-password').value='';hideAlert();
  });
  function renderStats(){
    const active=state.documents.filter(d=>d.activo===true).length;
    $('stat-published').textContent=String(active);
    $('stat-hidden').textContent=String(state.documents.length-active);
    $('stat-total').textContent=String(state.documents.length);
  }
  function resetEditor(){
    state.editId=null;$('document-form').reset();
    $('editor-title').textContent='Cargar nuevo procedimiento';
    $('editor-help').textContent='Agrega el PDF y los datos que verán los trabajadores.';
    $('save-document').textContent='Publicar procedimiento';
    $('cancel-edit').hidden=true;
    $('pdf-required').hidden=false;
    $('file-hint').textContent='Solo PDF, hasta 15 MB. Se publicará automáticamente.';
    $('doc-file').required=true;
  }
  $('cancel-edit').addEventListener('click',()=>{resetEditor();hideAlert();});
  function beginEdit(doc){
    state.editId=doc.id;
    $('doc-title').value=doc.titulo;
    $('doc-version').value=doc.version;
    $('doc-category').value=doc.categoria||'Otros';
    $('doc-description').value=doc.descripcion||'';
    $('doc-file').value='';$('doc-file').required=false;
    $('pdf-required').hidden=true;
    $('editor-title').textContent='Editar procedimiento';
    $('editor-help').textContent='Modifica los datos. Si adjuntas un nuevo PDF, reemplazará el actual manteniendo el mismo enlace.';
    $('file-hint').textContent='Opcional: adjunta otro PDF para reemplazar el vigente (máx. 15 MB).';
    $('save-document').textContent='Guardar cambios';
    $('cancel-edit').hidden=false;
    $('editor-card').scrollIntoView({behavior:'smooth',block:'start'});
    $('doc-title').focus();
  }
  function renderAdminList(){
    const target=$('admin-list');target.replaceChildren();
    const sorted=[...state.documents].sort((a,b)=>(b.actualizado||'').localeCompare(a.actualizado||''));
    if(!sorted.length){target.append(el('div','admin-empty','Aún no hay procedimientos. Utiliza el formulario para publicar el primero.'));return;}
    sorted.forEach(doc=>{
      const item=el('article','admin-item');item.append(el('h3',null,doc.titulo));
      const meta=el('div','admin-item-meta');meta.append(el('span','tag '+(doc.activo?'current':'hidden-tag'),doc.activo?'Publicado':'Despublicado'));
      meta.append(el('span',null,`Versión ${doc.version} · ${doc.categoria||'Otros'}`));
      const actions=el('div','admin-item-actions');
      const edit=el('button','action-link','Editar / nueva versión');edit.type='button';edit.addEventListener('click',()=>beginEdit(doc));
      const toggle=el('button','action-link'+(doc.activo?' warning':''),doc.activo?'Despublicar':'Volver a publicar');toggle.type='button';
      toggle.addEventListener('click',async()=>{
        if(state.busy)return;
        const action=doc.activo?'despublicar':'volver a publicar';
        if(!confirm(`¿Deseas ${action} "${doc.titulo}"?`))return;
        toggleBusy(true);hideAlert();
        try{
          await mutateCatalog(current=>current.map(d=>d.id===doc.id?{...d,activo:!d.activo,actualizado:new Date().toISOString()}:d),`${doc.activo?'Despublicar':'Publicar'} procedimiento: ${doc.titulo}`);
          alertMessage(`Procedimiento ${doc.activo?'despublicado':'publicado'} correctamente. La actualización aparecerá al desplegar GitHub Pages.`,'success');
        }catch(err){alertMessage('No se pudo cambiar el estado: '+err.message,'error');}
        finally{toggleBusy(false);}
      });
      actions.append(edit,toggle);item.append(meta,actions);target.append(item);
    });
  }
  $('document-form').addEventListener('submit',async event=>{
    event.preventDefault();if(state.busy||!state.token)return;hideAlert();
    const titulo=$('doc-title').value.trim();
    const version=$('doc-version').value.trim();
    const categoria=$('doc-category').value.trim();
    const descripcion=$('doc-description').value.trim();
    const file=$('doc-file').files[0];
    const editId=state.editId;
    if(!titulo||!version){alertMessage('El título y la versión son obligatorios.','error');return;}
    if(!editId&&!file){alertMessage('Debes adjuntar un archivo PDF.','error');return;}
    if(file){
      if(!file.name.toLowerCase().endsWith('.pdf')|| (file.type && file.type!=='application/pdf')){alertMessage('Solo se permiten archivos PDF.','error');return;}
      if(file.size>15*1024*1024){alertMessage('Este PDF supera los 15 MB. Comprímelo antes de subirlo.','error');return;}
      if(file.size===0){alertMessage('El PDF está vacío.','error');return;}
      const sig=new Uint8Array(await file.slice(0,5).arrayBuffer());
      if(String.fromCharCode(...sig)!=='%PDF-'){alertMessage('El archivo no parece ser un PDF válido.','error');return;}
    }
    const id=editId || crypto.randomUUID();
    const filepath=`pdfs/${id}.pdf`;
    toggleBusy(true);
    try{
      // Primero actualizar el PDF. La ruta fija evita URLs diferentes por cada versión.
      if(file){
        const found=await getFile(filepath);
        const raw=new Uint8Array(await file.arrayBuffer());
        await putFile(filepath,toBase64(raw),found?.sha,`${editId?'Actualizar':'Agregar'} PDF: ${titulo} v${version}`);
      }
      const now=new Date().toISOString();
      await mutateCatalog(current=>{
        const existing=current.find(d=>d.id===id);
        const record={id,titulo,version,categoria,descripcion,archivo:filepath,activo:existing?existing.activo:true,creado:existing?.creado||now,actualizado:now};
        return existing?current.map(d=>d.id===id?record:d):[...current,record];
      },`${editId?'Actualizar':'Publicar'} procedimiento: ${titulo} v${version}`);
      resetEditor();
      alertMessage('Documento guardado en GitHub. Estará disponible para los trabajadores cuando termine la publicación de GitHub Pages.','success');
    }catch(err){alertMessage('No se pudo completar la publicación: '+err.message+'. Si se cargó el PDF antes del error, vuelve a guardar el formulario para sincronizar el catálogo.','error');}
    finally{toggleBusy(false);}
  });
  // SEGUNDO MÓDULO: REGISTROS DE ACCIDENTABILIDAD, TOP 4 Y APRENDIZAJES
  const incidentTypes=['Top 4','Accidente ESM','Accidente Centinela','Aprendizaje'];
  const validIncidentDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
  function selectAdminTab(name){
    const incidents=name==='incidents';
    $('procedures-workspace').hidden=incidents;
    $('incidents-workspace').hidden=!incidents;
    $('tab-procedures').classList.toggle('active',!incidents);
    $('tab-incidents').classList.toggle('active',incidents);
    $('tab-procedures').setAttribute('aria-pressed',String(!incidents));
    $('tab-incidents').setAttribute('aria-pressed',String(incidents));
    hideAlert();
  }
  $('tab-procedures').addEventListener('click',()=>selectAdminTab('procedures'));
  $('tab-incidents').addEventListener('click',()=>selectAdminTab('incidents'));
  function renderIncidentStats(){
    const active=state.incidents.filter(x=>x.activo===true).length;
    $('stat-incidents-active').textContent=String(active);
    $('stat-incidents-hidden').textContent=String(state.incidents.length-active);
    $('stat-incidents-all').textContent=String(state.incidents.length);
  }
  function resetIncidentEditor(){
    state.incidentEditId=null;
    $('incident-form').reset();
    $('incident-type').value='Top 4';
    $('incident-file').value='';
    $('incident-remove-pdf').checked=false;
    $('incident-remove-wrap').hidden=true;
    $('incident-file-hint').textContent='Puedes publicar sin PDF. Si adjuntas uno, debe ser PDF y pesar máximo 15 MB.';
    $('incident-editor-title').textContent='Agregar hecho o aprendizaje';
    $('save-incident').textContent='Publicar registro';
    $('cancel-incident-edit').hidden=true;
  }
  $('cancel-incident-edit').addEventListener('click',()=>{resetIncidentEditor();hideAlert();});
  function editIncident(item){
    state.incidentEditId=item.id;
    $('incident-type').value=item.tipo;
    $('incident-date').value=item.fecha;
    $('incident-place').value=item.lugar;
    $('incident-what').value=item.paso;
    $('incident-lesson').value=item.reforzar;
    $('incident-file').value='';
    $('incident-remove-pdf').checked=false;
    $('incident-remove-wrap').hidden=!item.archivo;
    $('incident-file-hint').textContent=item.archivo
      ? 'Ya existe un PDF adjunto. Déjalo vacío para conservarlo o selecciona otro para reemplazarlo (máx. 15 MB).'
      : 'Puedes dejarlo vacío o agregar un PDF (máx. 15 MB).';
    $('incident-editor-title').textContent='Editar registro';
    $('save-incident').textContent='Guardar cambios';
    $('cancel-incident-edit').hidden=false;
    $('incident-editor-card').scrollIntoView({behavior:'smooth',block:'start'});
    $('incident-place').focus();
  }
  function renderIncidentList(){
    const target=$('admin-incident-list');target.replaceChildren();
    const sorted=[...state.incidents].sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
    if(!sorted.length){target.append(el('div','admin-empty','Todavía no hay registros. Publica uno desde el formulario.'));return;}
    for(const item of sorted){
      const node=el('article','admin-item');
      node.append(el('h3',null,item.paso));
      const meta=el('div','admin-item-meta');
      meta.append(el('span','tag '+(item.activo?'current':'hidden-tag'),item.activo?'Publicado':'Despublicado'));
      meta.append(el('span',null,`${item.tipo} · ${item.fecha} · ${item.lugar}`));
      if(item.archivo)meta.append(el('span','tag neutral','PDF adjunto'));
      node.append(meta);
      const actions=el('div','admin-item-actions');
      const edit=el('button','action-link','Editar');edit.type='button';edit.addEventListener('click',()=>editIncident(item));
      const toggle=el('button','action-link'+(item.activo?' warning':''),item.activo?'Despublicar':'Volver a publicar');toggle.type='button';
      toggle.addEventListener('click',async()=>{
        if(state.busy)return;
        const action=item.activo?'despublicar':'volver a publicar';
        if(!confirm(`¿Deseas ${action} el registro del ${item.fecha}?`))return;
        toggleBusy(true);hideAlert();
        try{
          await mutateIncidents(current=>current.map(x=>x.id===item.id?{...x,activo:!x.activo,actualizado:new Date().toISOString()}:x),`${item.activo?'Despublicar':'Publicar'} registro preventivo ${item.fecha}`);
          alertMessage('Estado actualizado. Los cambios aparecerán después del despliegue de GitHub Pages.','success');
        }catch(err){alertMessage('No se pudo cambiar el estado: '+err.message,'error');}
        finally{toggleBusy(false);}
      });
      actions.append(edit,toggle);node.append(actions);target.append(node);
    }
  }
  $('incident-form').addEventListener('submit',async event=>{
    event.preventDefault();if(state.busy||!state.token)return;hideAlert();
    const tipo=$('incident-type').value;
    const fecha=$('incident-date').value;
    const lugar=$('incident-place').value.trim();
    const paso=$('incident-what').value.trim();
    const reforzar=$('incident-lesson').value.trim();
    const file=$('incident-file').files[0]; // El PDF no es obligatorio en ningún tipo de registro.
    const removePdf=$('incident-remove-pdf').checked;
    if(!incidentTypes.includes(tipo)||!validIncidentDate(fecha)||!lugar||!paso||!reforzar){alertMessage('Completa la clasificación, fecha y los tres campos de texto.','error');return;}
    if(file && removePdf){alertMessage('Selecciona solo una opción: reemplazar el PDF o quitar el adjunto actual.','error');return;}
    if(file){
      if(!file.name.toLowerCase().endsWith('.pdf')||(file.type&&file.type!=='application/pdf')){alertMessage('Solo se permiten archivos PDF.','error');return;}
      if(file.size>15*1024*1024){alertMessage('El PDF supera los 15 MB. Comprímelo antes de subirlo.','error');return;}
      if(file.size===0){alertMessage('El PDF seleccionado está vacío.','error');return;}
      const signature=new Uint8Array(await file.slice(0,5).arrayBuffer());
      if(String.fromCharCode(...signature)!=='%PDF-'){alertMessage('El archivo seleccionado no parece ser un PDF válido.','error');return;}
    }
    const id=state.incidentEditId||crypto.randomUUID();
    const isEdit=!!state.incidentEditId;
    // El Worker actual permite pdfs/<UUID>.pdf, sin necesidad de modificar Cloudflare.
    const filepath=`pdfs/${id}.pdf`;
    const now=new Date().toISOString();
    toggleBusy(true);
    try{
      if(file){
        const found=await getFile(filepath);
        const bytes=new Uint8Array(await file.arrayBuffer());
        await putFile(filepath,toBase64(bytes),found?.sha,`${isEdit?'Actualizar':'Adjuntar'} PDF de ${tipo}: ${fecha}`);
      }
      await mutateIncidents(current=>{
        const previous=current.find(x=>x.id===id);
        const archivo=file?filepath:(removePdf?null:(previous?.archivo||null));
        const record={id,tipo,fecha,lugar,paso,reforzar,activo:previous?previous.activo:true,creado:previous?.creado||now,actualizado:now,...(archivo?{archivo}:{})};
        return previous?current.map(x=>x.id===id?record:x):[...current,record];
      },`${isEdit?'Actualizar':'Publicar'} registro ${tipo}: ${fecha}`);
      resetIncidentEditor();
      alertMessage('Registro guardado'+(file?' con PDF adjunto':'')+'. Aparecerá en la biblioteca de Accidentabilidad y TOP 4 al finalizar el despliegue de GitHub Pages.','success');
    }catch(err){alertMessage('No se pudo completar la publicación: '+err.message+'. Si el PDF alcanzó a subirse antes del error, vuelve a guardar el formulario para sincronizar el registro.','error');}
    finally{toggleBusy(false);}
  });
})();
