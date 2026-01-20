const fs = require('fs');
const path = require('path');

const items = [
  // Heads
  { code: 'head_classic', name: 'Classic Human', color: '#ffccaa', emoji: '🧑' },
  { code: 'head_round', name: 'Round Face', color: '#ffccaa', emoji: '🌝' },
  { code: 'head_square', name: 'Square Jaw', color: '#ffccaa', emoji: '🗿' },
  { code: 'head_alien', name: 'Alien', color: '#33cc33', emoji: '👽' },
  { code: 'head_monster', name: 'Monster', color: '#cc3333', emoji: '👹' },
  { code: 'head_celestial', name: 'Celestial', color: '#33ffff', emoji: '✨' },
  // Bodies
  { code: 'body_tshirt_white', name: 'White T-Shirt', color: '#ffffff', emoji: '👕' },
  { code: 'body_tshirt_black', name: 'Black T-Shirt', color: '#000000', emoji: '👕' },
  { code: 'body_jacket_leather', name: 'Leather Jacket', color: '#333333', emoji: '🧥' },
  { code: 'body_suit_formal', name: 'Business Suit', color: '#000033', emoji: '👔' },
  { code: 'body_tuxedo', name: 'Tuxedo', color: '#000000', emoji: '🤵' },
  { code: 'body_armor_knight', name: 'Armor', color: '#cccccc', emoji: '🛡️' },
  // Legs
  { code: 'legs_jeans_blue', name: 'Blue Jeans', color: '#0000cc', emoji: '👖' },
  { code: 'legs_jeans_black', name: 'Black Jeans', color: '#000000', emoji: '👖' },
  { code: 'legs_shorts', name: 'Shorts', color: '#666666', emoji: '🩳' },
  { code: 'legs_pants_formal', name: 'Dress Pants', color: '#000000', emoji: '👖' },
  { code: 'legs_pants_leather', name: 'Leather Pants', color: '#333333', emoji: '👖' },
  // Feet
  { code: 'feet_sneakers', name: 'Sneakers', color: '#ffffff', emoji: '👟' },
  { code: 'feet_shoes_dress', name: 'Black Shoes', color: '#000000', emoji: '👞' },
  { code: 'feet_boots', name: 'Boots', color: '#663300', emoji: '🥾' },
  { code: 'feet_heels', name: 'Heels', color: '#cc0000', emoji: '👠' },
  { code: 'feet_sandals', name: 'Sandals', color: '#996633', emoji: '👡' },
  // Accessories
  { code: 'acc_sunglasses', name: 'Sunglasses', color: '#000000', emoji: '🕶️' },
  { code: 'acc_chain_gold', name: 'Gold Chain', color: '#ffcc00', emoji: '⛓️' },
  { code: 'acc_crown', name: 'Crown', color: '#ffd700', emoji: '👑' },
  { code: 'acc_hat_top', name: 'Top Hat', color: '#000000', emoji: '🎩' },
  { code: 'acc_hat_cowboy', name: 'Cowboy Hat', color: '#8b4513', emoji: '🤠' },
  { code: 'acc_beanie', name: 'Beanie', color: '#ff6600', emoji: '🧢' },
  { code: 'acc_pipe', name: 'Pipe', color: '#663300', emoji: '🚬' },
  { code: 'acc_watch', name: 'Watch', color: '#d4af37', emoji: '⌚' },
];

const outputDir = path.join(__dirname, '../public/assets/troll-mart');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

items.forEach(item => {
  const svgContent = `
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f0f0f0" />
  <rect x="20" y="20" width="160" height="160" fill="${item.color}" rx="20" />
  <text x="50%" y="50%" font-family="Arial" font-size="60" text-anchor="middle" dy=".3em">${item.emoji}</text>
  <text x="50%" y="90%" font-family="Arial" font-size="14" text-anchor="middle" fill="#333">${item.name}</text>
</svg>
  `.trim();

  fs.writeFileSync(path.join(outputDir, `${item.code}.svg`), svgContent);
  console.log(`Generated ${item.code}.svg`);
});
