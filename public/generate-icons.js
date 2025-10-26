// Simple script to generate placeholder PWA icons using Node.js
const fs = require('fs');

function generateSVGIcon(size, maskable = false) {
  const padding = maskable ? size * 0.15 : 0;
  const iconSize = size - (padding * 2);
  const x = padding;
  const y = padding;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#3b82f6"/>
  <rect x="${x + iconSize * 0.15}" y="${y + iconSize * 0.2}" width="${iconSize * 0.7}" height="${iconSize * 0.15}" rx="4" fill="white"/>
  <rect x="${x + iconSize * 0.15}" y="${y + iconSize * 0.45}" width="${iconSize * 0.7}" height="${iconSize * 0.08}" rx="2" fill="white" opacity="0.7"/>
  <rect x="${x + iconSize * 0.15}" y="${y + iconSize * 0.6}" width="${iconSize * 0.5}" height="${iconSize * 0.08}" rx="2" fill="white" opacity="0.7"/>
</svg>`;
}

// Generate icons
fs.writeFileSync('icon-192.svg', generateSVGIcon(192, false));
fs.writeFileSync('icon-512.svg', generateSVGIcon(512, false));
fs.writeFileSync('icon-maskable-192.svg', generateSVGIcon(192, true));
fs.writeFileSync('icon-maskable-512.svg', generateSVGIcon(512, true));

console.log('Generated SVG icons');
