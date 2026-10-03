const fs = require('fs');
const path = require('path');

const sampleDir = path.join(__dirname, '..', 'data');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="#0f172a" />
  <rect x="50" y="50" width="1100" height="700" rx="16" fill="#1e293b" stroke="#38bdf8" stroke-width="3" />
  <circle cx="100" cy="120" r="24" fill="#10b981" />
  <text x="140" y="128" fill="#ffffff" font-family="sans-serif" font-size="28" font-weight="bold">Hack Odyssey 4.0 - Registration Confirmed</text>
  <text x="100" y="220" fill="#94a3b8" font-family="sans-serif" font-size="20">Team Name: CyberKnights</text>
  <text x="100" y="270" fill="#94a3b8" font-family="sans-serif" font-size="20">Captain: Arjun Sundaram (1300)</text>
  <text x="100" y="320" fill="#94a3b8" font-family="sans-serif" font-size="20">Member 2: Bhavya Srikanth (1301)</text>
  <text x="100" y="370" fill="#94a3b8" font-family="sans-serif" font-size="20">Member 3: Chirag Patel (1302)</text>
  <rect x="100" y="440" width="300" height="60" rx="10" fill="#10b981" />
  <text x="250" y="478" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">STATUS: REGISTERED</text>
</svg>`;

fs.writeFileSync(path.join(sampleDir, 'test_registration_screenshot.png'), svg);
console.log('✓ Sample screenshot test image created.');
