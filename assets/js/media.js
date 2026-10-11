// Photos and clips for the TikTok and Biking projects.
// Put files in assets/media/tiktok/ or assets/media/biking/ and list them below, e.g.
//   { type: 'image', src: 'assets/media/biking/rebuild-before.jpg', caption: 'Before: the corroded drivetrain' }
//   { type: 'video', src: 'assets/media/tiktok/study-day.mp4', poster: 'assets/media/tiktok/study-day.jpg', caption: '…' }
//   { type: 'tiktok', url: 'https://www.tiktok.com/@lil_indian_boi/video/1234567890' }
// A project with no media simply doesn't show a gallery.
// Privacy: images and videos stored here are fine. A 'tiktok' embed loads TikTok's player, which sets TikTok's own
// cookies and tracking, so before using one, add a click-to-load step and a line about it in legal.html#privacy.
export const MEDIA = {
  tiktok: [],
  biking: [],
};

const esc = (s = '') => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function item(m) {
  if (m.type === 'tiktok') {
    const id = (m.url.match(/video\/(\d+)/) || [])[1];
    if (!id) return '';
    return `<figure class="media-item tall"><iframe src="https://www.tiktok.com/embed/v2/${id}" title="${esc(m.caption || 'TikTok video')}" loading="lazy" allow="encrypted-media; fullscreen" allowfullscreen></iframe>${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}</figure>`;
  }
  if (m.type === 'video') {
    return `<figure class="media-item${m.tall ? ' tall' : ''}"><video src="${esc(m.src)}"${m.poster ? ` poster="${esc(m.poster)}"` : ''} controls playsinline preload="metadata"></video>${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}</figure>`;
  }
  return `<figure class="media-item${m.tall ? ' tall' : ''}"><img src="${esc(m.src)}" alt="${esc(m.caption || '')}" loading="lazy">${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}</figure>`;
}

export function renderMedia(project, host) {
  if (!host || host.dataset.ready) return;
  host.dataset.ready = '1';
  const list = MEDIA[project] || [];
  const wrap = host.closest('[data-media-wrap]');
  if (!list.length) { if (wrap) wrap.hidden = true; return; }
  if (wrap) wrap.hidden = false;
  host.innerHTML = list.map(item).join('');
}
