'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const types = ['Top 4', 'Accidente ESM', 'Accidente Centinela', 'Aprendizaje'];
  const accidents = new Set(['Accidente ESM','Accidente Centinela']);
  const itemsEl = $('incident-cards');
  let records = [];
  let currentYear = new Date().getFullYear();
  let selectedType = 'Todos';
  const make = (tag, cls, value) => { const node=document.createElement(tag); if(cls)node.className=cls; if(value !== undefined)node.textContent=value; return node; };
  const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10) === value;
  const formatDate = d => new Date(d+'T12:00:00Z').toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'});
  function refreshYears() {
    const years=[...new Set([new Date().getFullYear(), ...records.map(r=>Number(r.fecha.slice(0,4)) )])].sort((a,b)=>b-a);
    if(!years.includes(currentYear))currentYear=years[0];
    const sel=$('year');sel.replaceChildren();
    years.forEach(year=>{const opt=make('option',null,String(year));opt.value=String(year);sel.append(opt);});
    sel.value=String(currentYear);
  }
  function refreshFilters() {
    const panel=$('incident-filters');panel.replaceChildren();
    ['Todos',...types].forEach(t=>{
      const btn=make('button','filter-chip'+(t===selectedType?' active':''),t);btn.type='button';btn.setAttribute('aria-pressed',String(t===selectedType));
      btn.addEventListener('click',()=>{selectedType=t;refreshFilters();render();});panel.append(btn);
    });
  }
  function render() {
    const annual=records.filter(r=>Number(r.fecha.slice(0,4))===currentYear);
    const count=t=>annual.filter(r=>r.tipo===t).length;
    $('accidents-total').textContent=String(annual.filter(r=>accidents.has(r.tipo)).length);
    $('accidents-esm').textContent=String(count('Accidente ESM'));
    $('accidents-centinela').textContent=String(count('Accidente Centinela'));
    $('count-top4').textContent=String(count('Top 4'));
    $('count-learning').textContent=String(count('Aprendizaje'));
    $('year-label').textContent='Año '+currentYear;
    const visible=annual.filter(r=>selectedType==='Todos'||r.tipo===selectedType).sort((a,b)=>b.fecha.localeCompare(a.fecha));
    $('incident-counter').textContent=visible.length+' '+(visible.length===1?'registro':'registros');
    itemsEl.replaceChildren();
    $('incident-empty').hidden=visible.length!==0;
    if(!visible.length){
      $('incident-empty-title').textContent=annual.length?'Sin resultados en esta clasificación':'No hay registros publicados para '+currentYear;
      $('incident-empty-detail').textContent=annual.length?'Selecciona otra clasificación.':'Los registros aparecerán aquí cuando el administrador los publique.';
    }
    for(const r of visible){
      const card=make('article','incident-card');
      const header=make('div','incident-card-header');
      header.append(make('span','incident-type type-'+types.indexOf(r.tipo),r.tipo),make('time','incident-date',formatDate(r.fecha)));
      header.lastChild.dateTime=r.fecha;
      const place=make('div','incident-field');place.append(make('span','incident-field-label','DÓNDE FUE'),make('p',null,r.lugar));
      const what=make('div','incident-field');what.append(make('span','incident-field-label','QUÉ PASÓ'),make('p',null,r.paso));
      const lesson=make('div','incident-field lesson-field');lesson.append(make('span','incident-field-label','QUÉ REFORZAR'),make('p',null,r.reforzar));
      card.append(header,place,what,lesson);
      // El enlace solo aparece cuando el administrador adjuntó un PDF.
      // Validar la ruta evita insertar enlaces externos o arbitrarios en el catálogo.
      if(typeof r.archivo==='string' && /^pdfs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i.test(r.archivo)){
        const pdf=make('a','incident-pdf-link','📄 Ver PDF complementario');
        pdf.href=r.archivo;
        pdf.target='_blank';
        pdf.rel='noopener noreferrer';
        pdf.setAttribute('aria-label',`Abrir PDF complementario de ${r.tipo}, ${formatDate(r.fecha)} (nueva pestaña)`);
        card.append(pdf);
      }
      itemsEl.append(card);
    }
  }
  $('year').addEventListener('change',e=>{currentYear=Number(e.target.value);render();});
  async function load(){
    try{
      const response=await fetch(`data/accidentabilidad.json?v=${Date.now()}`,{cache:'no-store'});
      if(!response.ok)throw new Error('Error HTTP '+response.status);
      const data=await response.json();
      if(!Array.isArray(data.registros))throw new Error('Formato de datos incorrecto');
      records=data.registros.filter(r=>r&&r.activo===true&&types.includes(r.tipo)&&isDate(r.fecha)&&typeof r.lugar==='string'&&typeof r.paso==='string'&&typeof r.reforzar==='string');
    }catch(err){
      const notice=$('incident-notice');notice.hidden=false;notice.className='notice error';notice.textContent='No fue posible cargar la información. Revisa tu conexión y actualiza la página.';
    }
    refreshYears();refreshFilters();render();
  }
  load();
})();
