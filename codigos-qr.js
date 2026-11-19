'use strict';
(() => {
 const $=id=>document.getElementById(id);
 const base=new URL('./',window.location.href);
 const entries=[{id:'proc',url:base.href,file:'QR_Procedimientos_ESM.png'},{id:'acc',url:new URL('accidentabilidad.html',base).href,file:'QR_Accidentabilidad_TOP4_ESM.png'}];
 if(!window.QRCode){$('qr-alert').hidden=false;$('qr-alert').textContent='No se pudo cargar el generador de QR. Conéctate a internet y vuelve a abrir esta página.';return;}
 for(const item of entries){
   $('qr-'+item.id+'-url').textContent=item.url;
   new QRCode($('qr-'+item.id),{text:item.url,width:300,height:300,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
   const button=$('download-'+item.id);
   button.disabled=false;
   button.addEventListener('click',()=>{
     const box=$('qr-'+item.id);
     const canvas=box.querySelector('canvas');
     const img=box.querySelector('img');
     let uri=canvas?.toDataURL('image/png')||img?.src;
     if(!uri){$('qr-alert').hidden=false;$('qr-alert').textContent='Aún no se pudo preparar la imagen QR. Prueba recargando la página.';return;}
     const a=document.createElement('a');a.href=uri;a.download=item.file;document.body.append(a);a.click();a.remove();
   });
 }
})();
