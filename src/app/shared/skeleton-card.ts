import { Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton-card',
  standalone: true,
  template: `<article class="skeleton-card" aria-hidden="true" [class.with-cover]="cover()"><span class="skeleton-avatar"></span><span class="skeleton-line short"></span><span class="skeleton-line title"></span><span class="skeleton-line"></span><span class="skeleton-line medium"></span></article>`,
  styles: [`.skeleton-card{display:grid;grid-template-columns:36px 1fr;gap:12px;padding:24px;border:1px solid var(--border);border-radius:16px;background:var(--surface);min-height:180px}.skeleton-avatar,.skeleton-line,.skeleton-card:before{background:linear-gradient(90deg,var(--skeleton,#e8e8e1) 25%,color-mix(in srgb,var(--skeleton,#e8e8e1),white 35%) 50%,var(--skeleton,#e8e8e1) 75%);background-size:200% 100%;border-radius:8px;animation:skeleton-shimmer 1.2s linear infinite}.skeleton-avatar{grid-row:span 2;width:36px;height:36px;border-radius:50%}.skeleton-line{height:14px}.skeleton-line.short{width:40%}.skeleton-line.title{grid-column:1/-1;width:70%;height:24px;margin-top:12px}.skeleton-line.medium{width:55%}.skeleton-card.with-cover{grid-template-columns:84px 1fr}.skeleton-card.with-cover:before{content:"";grid-row:1/6;grid-column:1;aspect-ratio:2/3}.skeleton-card.with-cover .skeleton-avatar{grid-column:2}.skeleton-card.with-cover .skeleton-line.title{grid-column:2}.skeleton-card.with-cover .skeleton-line{grid-column:2}@keyframes skeleton-shimmer{to{background-position:-200% 0}}@media(prefers-reduced-motion:reduce){.skeleton-avatar,.skeleton-line,.skeleton-card:before{animation:none}}`]
})
export class SkeletonCard { readonly cover = input(false); }
