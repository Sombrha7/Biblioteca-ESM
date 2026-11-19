'use strict';
(() => {
  const byId = id => document.getElementById(id);
  const cards = byId('cards');
  const empty = byId('empty');
  const search = byId('search');
  const clear = byId('clear-search');
  const counter = byId('counter');
  const filters = byId('filters');
  const notice = byId('notice');
  const viewer = byId('pdf-dialog');
  let documents = [];
  let category = 'Todos';

  const safePath = item => {
    // Nunca cargar URLs remotas o rutas arbitrarias recibidas desde el catálogo.
    if (!item || !/^pdfs\/[a-zA-Z0-9-]+\.pdf$/.test(item.archivo || '')) return null;
    const revision = item.actualizado ? encodeURIComponent(item.actualizado) : '1';
    return `./${item.archivo}?revision=${revision}`;
  };
  const el = (name, cls, value) => {
    const node = document.createElement(name);
    if (cls) node.className = cls;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  function showNotice(message, isError=false) {
    notice.textContent = message;
    notice.className = isError ? 'notice error' : 'notice';
    notice.hidden = false;
  }
  function openPDF(item) {
    const src = safePath(item);
    if (!src) { showNotice('Este procedimiento no tiene un PDF válido. Informa a quien administra la biblioteca.', true); return; }
    byId('viewer-title').textContent = item.titulo;
    byId('viewer-version').textContent = `Versión ${item.version} · ${item.categoria || 'General'}`;
    byId('pdf-frame').src = src;
    byId('viewer-link').href = src;
    if (typeof viewer.showModal === 'function') viewer.showModal();
    else window.open(src,'_blank','noopener');
  }
  function closePDF() { if (viewer.open) viewer.close(); byId('pdf-frame').removeAttribute('src'); }
  byId('close-viewer').addEventListener('click',closePDF);
  viewer.addEventListener('click', event => { if(event.target === viewer) closePDF(); });
  viewer.addEventListener('close',() => byId('pdf-frame').removeAttribute('src'));

  function renderFilters() {
    filters.replaceChildren();
    const categories = ['Todos',...new Set(documents.map(d => d.categoria || 'Otros'))];
    categories.forEach(c => {
      const btn = el('button','filter-chip'+(c === category ? ' active':''),c);
      btn.type='button';btn.setAttribute('aria-pressed',String(c === category));
      btn.addEventListener('click',() => { category = c; renderFilters(); render(); });
      filters.append(btn);
    });
  }
  function render() {
    const query = search.value.trim().toLocaleLowerCase('es');
    clear.hidden = !search.value;
    const filtered = documents.filter(d => {
      const catMatch = category === 'Todos' || (d.categoria || 'Otros') === category;
      const haystack = [d.titulo,d.version,d.categoria,d.descripcion].filter(Boolean).join(' ').toLocaleLowerCase('es');
      return catMatch && haystack.includes(query);
    });
    counter.textContent = `${filtered.length} ${filtered.length === 1 ? 'documento' : 'documentos'}`;
    cards.replaceChildren();
    empty.hidden = filtered.length > 0;
    if (!filtered.length) {
      byId('empty-title').textContent = documents.length ? 'No encontramos coincidencias' : 'Aún no hay procedimientos publicados';
      byId('empty-detail').textContent = documents.length ? 'Prueba con otro nombre o categoría.' : 'Los procedimientos aparecerán aquí cuando el administrador los cargue.';
    }
    for (const d of filtered) {
      const card=el('article','document-card');
      const top=el('div','card-top');top.append(el('div','pdf-mark','PDF'),el('span','tag current','✓ Vigente'));
      const middle=el('div','card-middle');
      middle.append(el('span','doc-category',d.categoria || 'Otros'),el('h3',null,d.titulo));
      if (d.descripcion) middle.append(el('p','doc-description',d.descripcion));
      const bottom=el('div','card-bottom');
      const info=el('div','doc-meta');info.append(el('strong',null,`Versión ${d.version}`));
      info.append(el('span',null,d.actualizado ? `Actualizado ${new Date(d.actualizado).toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'})}` : 'Documento vigente'));
      const button=el('button','button primary small','Ver PDF ↗');button.type='button';button.addEventListener('click',()=>openPDF(d));
      bottom.append(info,button);card.append(top,middle,bottom);cards.append(card);
    }
  }
  search.addEventListener('input',render);
  clear.addEventListener('click',()=>{search.value='';search.focus();render();});
  async function load() {
    try {
      const response=await fetch(`data/catalogo.json?t=${Date.now()}`,{cache:'no-store'});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const result=await response.json();
      if(!result || !Array.isArray(result.documentos)) throw new Error('Catálogo inválido');
      documents=result.documentos.filter(d => d.activo === true && safePath(d) && typeof d.titulo === 'string').sort((a,b)=>a.titulo.localeCompare(b.titulo,'es'));
      renderFilters();render();
    } catch(error) {
      counter.textContent='Sin conexión';renderFilters();render();
      showNotice('No fue posible cargar el catálogo de documentos. Comprueba tu conexión y vuelve a actualizar la página.', true);
    }
  }
  load();
})();
