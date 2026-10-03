const fs = require('fs');
const path = require('path');

const postersDir = path.join(__dirname, '..', 'uploads', 'posters');
if (!fs.existsSync(postersDir)) {
  fs.mkdirSync(postersDir, { recursive: true });
}

const posters = [
  {
    name: 'poster_sample_1.webp',
    title: 'HACK ODYSSEY 4.0',
    subtitle: 'Kalasalingam Academy of Research and Education',
    tag: '24-HOUR FLAGSHIP HACKATHON',
    color1: '#4f46e5',
    color2: '#7c3aed'
  },
  {
    name: 'poster_sample_2.webp',
    title: 'SMART INDIA INNOVATION',
    subtitle: 'Ministry of Education & Innovation Cell',
    tag: 'NATIONWIDE SPRINT 2026',
    color1: '#059669',
    color2: '#0d9488'
  },
  {
    name: 'poster_sample_3.webp',
    title: 'DEVHACKS GLOBAL AI',
    subtitle: 'Google Cloud Student Developer Clubs',
    tag: 'MULTIMODAL AI CHALLENGE',
    color1: '#2563eb',
    color2: '#0284c7'
  },
  {
    name: 'poster_sample_4.webp',
    title: 'GREENTECH CYBERATHON',
    subtitle: 'Indian Institute of Information Technology',
    tag: 'SUSTAINABILITY & IOT',
    color1: '#d97706',
    color2: '#ea580c'
  }
];

posters.forEach(p => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
  <defs>
    <linearGradient id="grad_${p.name}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.color1}" />
      <stop offset="100%" stop-color="${p.color2}" />
    </linearGradient>
    <radialGradient id="glow" cx="80%" cy="20%" r="60%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="450" fill="url(#grad_${p.name})" />
  <rect width="800" height="450" fill="url(#glow)" />
  <g fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5">
    <circle cx="700" cy="100" r="180"/>
    <circle cx="700" cy="100" r="260"/>
    <circle cx="100" cy="380" r="150"/>
  </g>
  <rect x="50" y="45" width="220" height="32" rx="16" fill="rgba(255,255,255,0.2)" />
  <text x="65" y="66" fill="#ffffff" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="12" font-weight="700" letter-spacing="1.5">${p.tag}</text>
  <text x="50" y="160" fill="#ffffff" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="44" font-weight="800" letter-spacing="-1">${p.title}</text>
  <text x="50" y="210" fill="rgba(255,255,255,0.9)" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="20" font-weight="500">${p.subtitle}</text>
  <g transform="translate(50, 360)">
    <rect width="180" height="40" rx="8" fill="#ffffff" />
    <text x="90" y="25" fill="${p.color1}" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="14" font-weight="700" text-anchor="middle">OFFICIAL POSTER</text>
  </g>
</svg>`;

  fs.writeFileSync(path.join(postersDir, p.name), svg);
});

console.log('✓ Sample posters generated.');
