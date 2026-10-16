import { useEffect, useState } from 'react';
export type Tracking = {jobUrl?:string;appliedOn?:string;followUpOn?:string;notes?:string};
export function localDay(date=new Date()) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function isDue(item:{status:string;tracking?:Tracking}) {return !!item.tracking?.followUpOn && item.tracking.followUpOn<=localDay() && !['Oferta','Descartada'].includes(item.status);}
export function displayDate(day?:string) {return day ? day.split('-').reverse().join('/') : 'Sin fecha';}
export function TrackingEditor({item,onSave,onClose}:{item:{id:string;title:string;tracking?:Tracking};onSave:(tracking:Tracking)=>Promise<void>;onClose:()=>void}) {
 const [draft,setDraft]=useState<Tracking>({jobUrl:'',appliedOn:'',followUpOn:'',notes:'',...item.tracking});
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const dirty=Object.entries(draft).some(([k,v])=>v!==(item.tracking?.[k as keyof Tracking]??''));
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 return <section className="panel tracking-editor" aria-labelledby="tracking-title"><h2 id="tracking-title">Seguimiento · {item.title}</h2>
 <p className="muted">Guarda enlaces, fechas y notas para esta oportunidad. No se envían mensajes ni recordatorios automáticos.</p>
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await onSave(draft);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
 <fieldset disabled={busy} className="profile-fields"><legend className="sr-only">Datos de seguimiento</legend>
 <div className="wide"><label htmlFor="tracking-url">Enlace de la oferta</label><input autoFocus id="tracking-url" type="url" maxLength={2000} placeholder="https://…" value={draft.jobUrl} onChange={e=>setDraft({...draft,jobUrl:e.target.value})}/></div>
 <div><label htmlFor="tracking-applied">Fecha de postulación</label><input id="tracking-applied" type="date" min="1900-01-01" max="9999-12-31" value={draft.appliedOn} onChange={e=>setDraft({...draft,appliedOn:e.target.value})}/></div>
 <div><label htmlFor="tracking-next">Próximo seguimiento</label><input id="tracking-next" type="date" min="1900-01-01" max="9999-12-31" value={draft.followUpOn} onChange={e=>setDraft({...draft,followUpOn:e.target.value})}/></div>
 <div className="wide"><label htmlFor="tracking-notes">Notas</label><textarea id="tracking-notes" rows={5} maxLength={5000} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Contacto, entrevista, próximos pasos…"/><small>{draft.notes?.length??0}/5.000 caracteres</small></div></fieldset>
 {error&&<p role="alert" className="error">{error}</p>}
 <div className="profile-actions"><button className="primary" disabled={busy||!dirty}>{busy?'Guardando…':'Guardar seguimiento'}</button><button type="button" disabled={busy} onClick={()=>{if(!dirty||window.confirm('¿Descartar los cambios de seguimiento sin guardar?'))onClose();}}>Cerrar</button></div>
 </form></section>;
}
