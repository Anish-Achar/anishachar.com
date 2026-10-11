// Tile artwork for the Projects tab and the About-page shortcuts.
// Trading: the four tuned pair scripts at 20× leverage and the S&P 500 over the same dates
// (baked from assets/data/trading.json, viewBox 0 0 300 150, y = 132.7 is 0%).
const SPARK = {
  EURUSD: 'M0.0,132.7L3.0,133.6L10.8,131.0L16.5,128.4L17.6,133.4L23.5,131.2L29.5,132.3L36.1,128.9L37.5,132.6L40.6,129.3L44.6,131.3L47.6,129.1L51.1,130.9L54.7,126.3L58.7,118.5L58.9,115.0L59.6,118.7L64.6,111.9L71.3,114.1L73.7,115.4L79.6,112.1L92.7,105.5L93.6,101.8L103.3,97.5L103.8,95.5L106.4,97.1L108.8,93.0L109.6,95.7L134.8,87.8L138.5,84.9L142.6,91.7L166.2,87.0L187.6,82.6L193.0,81.2L193.7,85.8L199.8,85.6L201.2,83.0L204.5,85.8L208.3,80.1L213.5,81.9L214.5,79.2L221.3,83.2L225.0,82.0L227.7,90.0L228.6,91.6L235.6,87.6L241.8,90.9L243.6,88.4L299.9,88.4',
  GBPJPY: 'M0.0,132.7L3.4,132.4L8.6,130.0L12.7,133.9L16.0,131.1L19.4,126.6L36.9,128.8L40.2,129.5L43.6,127.0L45.5,125.4L57.2,118.4L61.0,124.3L65.5,120.0L67.5,115.6L68.5,112.5L72.6,106.0L73.1,103.2L79.5,101.7L81.1,98.6L81.6,103.2L86.2,103.2L89.6,99.0L91.9,101.3L101.0,95.1L108.5,101.7L113.6,105.7L120.0,103.9L122.4,96.4L128.9,92.8L130.6,93.2L134.6,90.3L138.6,86.6L143.4,84.4L148.5,82.8L152.0,86.1L156.4,91.2L218.5,81.6L222.1,84.1L229.1,87.8L233.8,85.0L236.3,86.8L241.8,89.1L242.4,90.6L242.9,79.5L246.0,69.0L249.6,62.8L253.8,61.5L262.5,65.1L277.3,53.3L282.1,40.2L292.1,47.4L295.4,43.4L299.9,46.3',
  GBPUSD: 'M0.0,132.7L3.7,128.6L11.8,126.6L17.2,125.3L37.1,122.7L40.4,120.1L50.0,123.3L54.7,115.6L58.5,110.7L61.8,105.8L65.6,108.4L67.6,99.6L71.0,102.5L79.3,107.0L88.5,108.1L92.3,101.7L100.3,92.4L107.6,93.5L109.6,98.3L117.7,101.2L122.0,104.2L129.0,97.8L134.6,98.3L137.4,92.5L138.8,95.5L166.6,85.9L176.5,80.7L179.1,78.6L183.6,82.5L193.7,79.7L199.8,83.5L200.8,78.7L205.5,82.5L212.2,82.7L214.5,75.8L227.3,73.3L228.4,76.3L239.5,78.0L242.3,79.7L243.7,74.1L262.5,69.4L264.4,66.5L270.4,67.4L290.8,60.0L292.7,63.2L297.6,57.3L299.9,56.2',
  AUDJPY: 'M0.0,132.7L3.0,130.7L11.1,129.6L16.7,133.3L18.0,129.9L30.1,127.5L33.6,125.2L40.6,131.4L45.5,129.5L51.2,125.8L54.0,117.4L57.1,111.3L60.6,100.2L66.6,106.2L68.4,109.1L73.6,97.9L80.6,97.6L85.0,103.3L92.6,109.7L100.5,94.6L102.6,90.2L108.1,92.2L117.0,82.3L120.9,85.7L122.0,92.9L124.6,94.5L128.9,92.1L136.6,81.3L140.9,76.5L149.0,74.7L164.6,59.9L170.3,69.3L179.1,67.4L185.4,64.7L187.0,60.5L208.1,52.1L212.4,56.0L218.2,52.1L229.5,45.3L233.0,48.4L243.0,46.9L247.8,43.1L255.4,37.7L261.7,33.9L271.6,28.1L277.1,23.9L282.1,5.1L285.1,10.7L292.1,3.3L299.9,0.0',
  SPX: 'M0.0,132.7L4.9,132.4L10.9,131.4L16.9,134.4L18.9,135.2L24.9,129.9L31.9,132.8L38.9,130.2L44.9,128.8L51.9,134.5L59.9,128.3L67.9,134.4L71.9,128.7L75.9,133.1L82.9,130.6L92.9,131.6L96.9,136.4L102.9,138.7L108.9,140.4L110.9,144.4L116.9,145.4L120.9,150.0L122.9,142.1L129.9,135.0L135.9,128.7L141.9,123.8L145.9,121.9L151.9,120.4L157.9,115.0L165.9,110.4L169.9,113.7L173.9,111.3L180.9,107.7L184.9,106.7L190.9,113.7L192.9,118.4L194.9,112.8L198.9,110.0L205.9,115.0L213.9,111.0L218.9,109.1L222.9,107.8L232.9,112.4L236.9,113.4L242.9,112.6L246.9,107.0L250.9,101.6L256.9,100.2L264.9,104.5L270.9,102.5L276.9,104.7L283.9,105.8L289.9,107.5L295.9,101.4L299.9,102.1',
};

// Fin can: a side-view technical drawing in millimetres (aft end at x = 0, nose to the right), from the
// same dimensions as the CAD: 102 mm airframe, 200/80 mm fins with an 80 mm span, 54 mm motor mount.
export function drawFinCanArt(svg) {
  svg.setAttribute('viewBox', '-40 -150 735 312');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const R = 51, Rm = 28.7, Ri = 49.2;
  const fin = (s) => `M15 ${s * R}L215 ${s * R}L95 ${s * (R + 80)}L15 ${s * (R + 80)}Z`;
  const ring = (x, w) => [-1, 1].map((s) => `<rect class="h" x="${x}" y="${s < 0 ? -Ri : Rm}" width="${w}" height="${Ri - Rm}"/>`).join('');
  svg.innerHTML = `
    <path class="c" d="M-32 0H688"/>
    ${[-1, 1].map((s) => `<path class="h" d="M0 ${s * Rm}H600"/><rect class="h" x="35" y="${s < 0 ? -R : Rm}" width="170" height="${R - Rm}"/>`).join('')}
    <path class="h" d="M600 ${-Rm}V${Rm}"/>
    ${ring(20, 6)}${ring(220, 6)}${ring(588, 12)}
    <path class="h" d="M600 -8H632A8 8 0 0 1 632 8H600"/>
    <rect class="o" x="0" y="${-R}" width="650" height="${2 * R}"/>
    <rect class="o" x="-10" y="-31.3" width="10" height="62.6"/>
    <path class="fin" d="${fin(-1)}"/><path class="fin" d="${fin(1)}"/>
    <path class="d" d="M0 146H650M0 138V154M650 138V154"/>
    <text x="325" y="138" text-anchor="middle">650</text>`;
}

// Zeto: three tracked applications at different stages, the last one at Offer (the app's own mint),
// with the four stage names under the bars.
export function drawZetoArt(svg) {
  svg.setAttribute('viewBox', '0 0 548 236');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const rows = [[168, 112, 2, 'Submitted', 70], [128, 150, 3, 'Interview', 66], [196, 96, 4, 'Offer', 46]];
  const seg = 128, gap = 8;
  svg.innerHTML = rows.map(([nw, lw, done, chip, cw], i) => {
    const y = 6 + i * 74, last = done === 4;
    return `
      <rect class="nm" x="0" y="${y}" width="${nw}" height="10" rx="5"/>
      <rect class="ln" x="0" y="${y + 17}" width="${lw}" height="6" rx="3"/>
      <rect class="chip${last ? ' go' : ''}" x="${548 - cw - 1}" y="${y - 3}" width="${cw}" height="22" rx="4"/>
      <text class="chip-t${last ? ' go' : ''}" x="${548 - cw / 2 - 1}" y="${y + 12}" text-anchor="middle">${chip}</text>
      ${[0, 1, 2, 3].map((k) => `<rect class="seg${k < done ? (last && k === 3 ? ' go' : ' on') : ''}" x="${k * (seg + gap)}" y="${y + 36}" width="${seg}" height="5" rx="2.5"/>`).join('')}`;
  }).join('') + ['Prep', 'Submitted', 'Interview', 'Offer'].map((s, k) => `<text class="lb${k === 3 ? ' go' : ''}" x="${k * (seg + gap)}" y="230">${s}</text>`).join('');
}

export function drawTradingArt(svg) {
  svg.setAttribute('viewBox', '-8 -12 316 176');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const shades = { EURUSD: '#5e5e5e', GBPUSD: '#808080', GBPJPY: '#a8a8a8', AUDJPY: '#ffffff' };
  svg.innerHTML = `
    <defs>
      <linearGradient id="spark-fill-${svg.dataset.k || 0}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".14"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
    </defs>
    ${[20, 55, 90, 125].map((y) => `<line x1="0" x2="300" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.06)"/>`).join('')}
    <line x1="0" x2="300" y1="132.7" y2="132.7" stroke="rgba(255,255,255,.2)"/>
    <path d="${SPARK.AUDJPY}L299.9,150L0,150Z" fill="url(#spark-fill-${svg.dataset.k || 0})"/>
    <path d="${SPARK.SPX}" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.3" stroke-dasharray="3 3"/>
    ${Object.entries(shades).map(([p, c]) => `<path d="${SPARK[p]}" fill="none" stroke="${c}" stroke-width="1.7" stroke-linejoin="round"/>`).join('')}
    <circle cx="299.9" cy="0" r="4" fill="#ffffff"/>`;
}
