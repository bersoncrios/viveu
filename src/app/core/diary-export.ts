import { ConsumptionEntry, JOURNEY_STATUSES, journeyStatus } from './models';

export const NEW_ENTRY_SESSION_KEY = 'viveu-new-entry-id';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!));
}

export function buildDiaryHtml(entries: ConsumptionEntry[], displayName: string, generatedAt = new Date()): string {
  const sorted = [...entries].sort((a,b) => (a.completedAt ?? a.updatedAt)-(b.completedAt ?? b.updatedAt));
  const years = new Map<number, ConsumptionEntry[]>();
  for (const entry of sorted) {const year=new Date(entry.completedAt ?? entry.updatedAt).getFullYear();years.set(year,[...(years.get(year)??[]),entry]);}
  const sections = [...years].map(([year,items]) => `<section><h2>${year}</h2>${items.map(entry => {
    const date=new Date(entry.completedAt ?? entry.updatedAt);
    const status=JOURNEY_STATUSES.find(item=>item.value===journeyStatus(entry))?.label ?? 'Jornada';
    const notes=(entry.notes??[]).map(note=>`<li><time>${escapeHtml(new Date(note.createdAt).toLocaleDateString('pt-BR'))}</time><p>${escapeHtml(note.text)}</p>${note.containsSpoilers?'<small>Nota com spoiler</small>':''}</li>`).join('');
    return `<article><header><time>${escapeHtml(date.toLocaleDateString('pt-BR'))}</time><span>${escapeHtml(entry.category)}</span><span>${escapeHtml(status)}</span></header><h3>${escapeHtml(entry.title)}</h3>${entry.rating?`<p class="rating">${entry.rating} / 5</p>`:''}${entry.quote?`<blockquote>${escapeHtml(entry.quote)}</blockquote>`:''}${entry.reflection?`<p>${escapeHtml(entry.reflection)}</p>`:''}${notes?`<details open><summary>Notas da jornada</summary><ul>${notes}</ul></details>`:''}</article>`;
  }).join('')}</section>`).join('');
  const period=sorted.length?`${new Date(sorted[0].completedAt??sorted[0].updatedAt).getFullYear()}–${new Date(sorted.at(-1)!.completedAt??sorted.at(-1)!.updatedAt).getFullYear()}`:'Acervo ainda começando';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Diário cultural de ${escapeHtml(displayName)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f4ed;color:#213c33;font:16px/1.65 system-ui,sans-serif}main{max-width:860px;margin:auto;padding:40px 22px}h1,h2,h3{font-family:Georgia,serif;font-weight:400}h1{font-size:42px}.cover{padding:72px 32px;background:#234c3b;color:#fffefa;border-radius:18px;margin-bottom:40px}.cover p{color:#e6ece3}.rating{color:#a94732;font-weight:700}article{break-inside:avoid;background:#fffefa;border:1px solid #d9ded3;border-radius:14px;padding:22px;margin:14px 0}article header{display:flex;gap:12px;flex-wrap:wrap;color:#626b62;font-size:13px}blockquote{border-left:3px solid #a94732;padding-left:14px;font:italic 20px/1.55 Georgia,serif}details{margin-top:20px}li{margin:12px 0}footer{margin-top:48px;padding-top:18px;border-top:1px solid #d9ded3;color:#626b62}@media print{body{background:white}main{max-width:none;padding:0}.cover,article{break-inside:avoid}.cover{print-color-adjust:exact}}</style></head><body><main><header class="cover"><p>VIVEU · DIÁRIO CULTURAL</p><h1>${escapeHtml(displayName)}</h1><p>${escapeHtml(period)} · ${sorted.length} ${sorted.length===1?'obra':'obras'}</p></header>${sections||'<p>Seu diário cultural começa com a próxima história.</p>'}<footer>Gerado pelo Viveu em ${escapeHtml(generatedAt.toLocaleDateString('pt-BR'))}.</footer></main></body></html>`;
}

export function downloadDiaryHtml(html: string, filename: string, browser: Pick<typeof URL,'createObjectURL'|'revokeObjectURL'> = URL): void {
  const blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=browser.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;link.click();setTimeout(()=>browser.revokeObjectURL(url),1000);
}
