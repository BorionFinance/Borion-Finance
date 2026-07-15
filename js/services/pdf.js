(() => {
  'use strict';
  const A4={w:595.28,h:841.89};
  const enc=new TextEncoder();
  const ascii=s=>enc.encode(String(s));
  function concat(chunks){let n=0;for(const c of chunks)n+=c.length;const out=new Uint8Array(n);let o=0;for(const c of chunks){out.set(c,o);o+=c.length;}return out;}
  function latinByte(ch){const code=ch.charCodeAt(0);if(code<=255)return code;const map={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};return map[ch]||63;}
  function hexText(value){let out='';for(const ch of String(value??'')){out+=latinByte(ch).toString(16).padStart(2,'0');}return `<${out}>`;}
  function money(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);}
  function date(v){if(!v)return '—';const d=new Date(String(v).length===10?`${v}T12:00:00`:v);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-BR').format(d);}
  function cleanName(v){return String(v||'arquivo').replace(/[\\/:*?"<>|]/g,'-');}
  function wrap(text,maxChars){const words=String(text??'').replace(/\s+/g,' ').trim().split(' ');if(!words[0])return ['—'];const lines=[];let line='';for(const w of words){if(!line){line=w;continue;}if((line+' '+w).length<=maxChars)line+=' '+w;else{lines.push(line);line=w;}}if(line)lines.push(line);return lines;}
  async function toJpeg(blob,max=1500){
    const bmp=await createImageBitmap(blob);const scale=Math.min(1,max/Math.max(bmp.width,bmp.height));const w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bmp,0,0,w,h);bmp.close?.();
    const out=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.86));return {bytes:new Uint8Array(await out.arrayBuffer()),width:w,height:h};
  }
  class Builder{
    constructor(){this.objects=[null];this.pages=[];this.pagesObj=this.reserve();this.catalogObj=this.reserve();this.fontRegular=this.add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');this.fontBold=this.add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');}
    reserve(){this.objects.push(null);return this.objects.length-1;}
    add(value){const n=this.reserve();this.set(n,value);return n;}
    set(n,value){this.objects[n]=typeof value==='string'?ascii(value):value;}
    stream(bytes,dict=''){return this.add(concat([ascii(`<< /Length ${bytes.length}${dict?' '+dict:''} >>\nstream\n`),bytes,ascii('\nendstream')]));}
    image(bytes,w,h){return this.stream(bytes,`/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`);}
    page(commands,images={}){const content=this.stream(ascii(commands));const names=Object.entries(images).map(([k,v])=>`/${k} ${v} 0 R`).join(' ');const resources=`<< /Font << /F1 ${this.fontRegular} 0 R /F2 ${this.fontBold} 0 R >>${names?` /XObject << ${names} >>`:''} >>`;const page=this.add(`<< /Type /Page /Parent ${this.pagesObj} 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources ${resources} /Contents ${content} 0 R >>`);this.pages.push(page);return page;}
    finish(){this.set(this.pagesObj,`<< /Type /Pages /Kids [${this.pages.map(n=>`${n} 0 R`).join(' ')}] /Count ${this.pages.length} >>`);this.set(this.catalogObj,`<< /Type /Catalog /Pages ${this.pagesObj} 0 R >>`);const chunks=[ascii('%PDF-1.4\n%âãÏÓ\n')],offsets=[0];let offset=chunks[0].length;for(let i=1;i<this.objects.length;i++){offsets[i]=offset;const part=concat([ascii(`${i} 0 obj\n`),this.objects[i],ascii('\nendobj\n')]);chunks.push(part);offset+=part.length;}const xref=offset;let table=`xref\n0 ${this.objects.length}\n0000000000 65535 f \n`;for(let i=1;i<this.objects.length;i++)table+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;table+=`trailer\n<< /Size ${this.objects.length} /Root ${this.catalogObj} 0 R >>\nstartxref\n${xref}\n%%EOF`;chunks.push(ascii(table));return new Blob([concat(chunks)],{type:'application/pdf'});}
  }
  function textCmd(text,x,y,size=10,bold=false,color='0.07 0.13 0.20'){return `BT ${color} rg /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm ${hexText(text)} Tj ET\n`;}
  function lineCmd(x1,y1,x2,y2,color='.82 .86 .9',width=.6){return `${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S\n`;}
  function imageCmd(name,x,y,w,h){return `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /${name} Do Q\n`;}

  async function generate(order,ctx={}){
    const b=new Builder();let bannerObj=0;
    try{const r=await fetch('assets/marco-banner.jpg');if(r.ok){const blob=await r.blob(),bmp=await createImageBitmap(blob);bannerObj=b.image(new Uint8Array(await blob.arrayBuffer()),bmp.width,bmp.height);bmp.close?.();}}catch(_){bannerObj=0;}
    const items=ctx.items||[],payments=ctx.payments||[],client=ctx.client||{},company=ctx.company||{};
    const itemName=it=>it.description||ctx.itemName?.(it)||[it.type,it.productId||it.serviceId||it.supplyId].filter(Boolean).join(' ');
    const lines=[];
    const section=t=>lines.push({text:t,bold:true,size:12,space:10,color:'0.02 0.14 0.27'});
    const field=(label,value)=>{const parts=wrap(`${label}: ${value||'—'}`,86);parts.forEach((p,i)=>lines.push({text:p,bold:i===0&&p.startsWith(label+':'),size:9.5,indent:i?12:0}));};
    section(`ORDEM DE SERVIÇO: ${order.id}`);field('Data de abertura',date(order.openedAt));field('Data de conclusão',date(order.completedAt));field('Status',order.status);
    section('DADOS DO CLIENTE');field('Nome',client.name||order.clientName);field('Telefone',client.phone);field('Documento',client.document);field('Endereço',[client.address,client.number,client.neighborhood,client.city].filter(Boolean).join(', '));
    section('DADOS DO EQUIPAMENTO');field('Equipamento',order.equipmentType);field('Marca / Modelo',order.brandModel);field('Número de série',order.serialNumber);field('Senha de acesso',order.accessPassword);field('Acessórios',order.accessories);
    section('DIAGNÓSTICO');field('Defeito relatado',order.reportedIssue);field('Laudo técnico',order.technicalReport);if(order.clientNotes)field('Observação ao cliente',order.clientNotes);
    section('ITENS E SERVIÇOS');
    if(items.length){items.forEach(it=>{const desc=itemName(it),qty=Number(it.quantity)||0,unit=Number(it.unitPrice)||0,sub=Number(it.subtotal)||qty*unit;wrap(`${qty} x ${desc} — ${money(unit)} — Subtotal ${money(sub)}`,86).forEach(p=>lines.push({text:p,size:9.2}));});}else lines.push({text:'Nenhum item informado.',size:9.2});
    lines.push({text:`Descontos: ${money(order.discount)}`,bold:true,size:10,space:7});lines.push({text:`Valor total: ${money(order.total)}`,bold:true,size:12,color:'1 0.31 0.12'});
    section('PAGAMENTOS');
    if(payments.length){payments.forEach(p=>wrap(`${date(p.dueDate)} | ${p.paymentMethod||'—'} | ${p.status||'Pendente'} | ${money(p.value)}`,86).forEach(t=>lines.push({text:t,size:9.2})));}else lines.push({text:'Nenhum pagamento informado.',size:9.2});
    if(company.defaultNote){section('OBSERVAÇÃO');wrap(company.defaultNote,86).forEach(t=>lines.push({text:t,size:9.2}));}

    let pageNo=0,index=0;
    while(index<lines.length||pageNo===0){let cmd='',images={};let y=A4.h-45;
      if(pageNo===0&&bannerObj){images.Banner=bannerObj;cmd+=imageCmd('Banner',35,A4.h-178,A4.w-70,132);y=A4.h-200;}else{cmd+=textCmd(`Marco Iris Soluções em Tecnologia • ${order.id}`,40,A4.h-44,10,true,'0.02 0.14 0.27');cmd+=lineCmd(40,A4.h-54,A4.w-40,A4.h-54);y=A4.h-78;}
      while(index<lines.length){const l=lines[index],h=(l.size||9.5)+4+(l.space||0);if(y-h<55)break;y-=l.space||0;cmd+=textCmd(l.text,40+(l.indent||0),y,l.size||9.5,!!l.bold,l.color||'0.07 0.13 0.20');y-=l.size+4;index++;}
      cmd+=lineCmd(40,38,A4.w-40,38);cmd+=textCmd(`Página ${pageNo+1}`,A4.w-82,24,8,false,'.42 .48 .56');b.page(cmd,images);pageNo++;
    }

    const photos=order.photos||[];
    if(ctx.getPhotoBlob){for(let i=0;i<photos.length;i++){try{const blob=await ctx.getPhotoBlob(photos[i]);if(!blob)continue;const img=await toJpeg(blob);const obj=b.image(img.bytes,img.width,img.height);const maxW=A4.w-80,maxH=A4.h-125,scale=Math.min(maxW/img.width,maxH/img.height),w=img.width*scale,h=img.height*scale,x=(A4.w-w)/2,y=(A4.h-h)/2-15;let cmd=textCmd(`FOTO ${i+1} — ${order.id}`,40,A4.h-45,12,true,'0.02 0.14 0.27');cmd+=imageCmd('Photo',x,y,w,h);cmd+=textCmd(photos[i].fileName||`Foto ${i+1}`,40,28,8,false,'.42 .48 .56');b.page(cmd,{Photo:obj});}catch(e){console.warn('Foto ignorada no PDF:',e);}}
    }
    return {blob:b.finish(),fileName:`${cleanName(order.id)}_${cleanName(client.name||order.clientName||'Cliente')}.pdf`};
  }
  window.MarcoPdf={generate};
})();
