const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const buildDir = path.join(__dirname, '..', 'build')
fs.mkdirSync(buildDir, { recursive: true })

// Kingdom Quest icon - crown, sword, and shield on dark purple background
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#2d1b69"/>
      <stop offset="100%" style="stop-color:#0d0524"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="40%">
      <stop offset="0%" style="stop-color:#5a3fc0;stop-opacity:0.8"/>
      <stop offset="100%" style="stop-color:#5a3fc0;stop-opacity:0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="512" height="512" rx="80" fill="url(#bg)"/>
  <ellipse cx="256" cy="220" rx="220" ry="180" fill="url(#glow)"/>

  <!-- Stars -->
  <circle cx="70" cy="70" r="3" fill="#ffd700" opacity="0.9"/>
  <circle cx="440" cy="90" r="2.5" fill="#ffd700" opacity="0.7"/>
  <circle cx="50" cy="390" r="2" fill="#ffd700" opacity="0.6"/>
  <circle cx="470" cy="410" r="3" fill="#ffd700" opacity="0.8"/>
  <circle cx="130" cy="460" r="2" fill="#ffd700" opacity="0.5"/>
  <circle cx="390" cy="455" r="2.5" fill="#ffd700" opacity="0.6"/>
  <circle cx="480" cy="200" r="2" fill="#ffd700" opacity="0.5"/>
  <circle cx="30" cy="240" r="1.5" fill="#ffd700" opacity="0.4"/>

  <!-- Shield base -->
  <path d="M256 330 L146 262 L146 152 L256 128 L366 152 L366 262 Z"
        fill="#3a2480" stroke="#ffd700" stroke-width="5"/>
  <path d="M256 310 L162 250 L162 164 L256 143 L350 164 L350 250 Z"
        fill="#1a0a2e" stroke="#7b5fc0" stroke-width="2"/>

  <!-- Cross on shield -->
  <rect x="246" y="153" width="20" height="130" rx="5" fill="#ffd700" opacity="0.9"/>
  <rect x="192" y="203" width="128" height="20" rx="5" fill="#ffd700" opacity="0.9"/>

  <!-- Crown -->
  <path d="M176 148 L176 108 L212 132 L256 95 L300 132 L336 108 L336 148 Z"
        fill="#ffd700" stroke="#ff9900" stroke-width="3"/>
  <rect x="176" y="148" width="160" height="28" rx="6" fill="#ffd700"/>

  <!-- Crown gems -->
  <circle cx="256" cy="107" r="11" fill="#ff3388"/>
  <circle cx="256" cy="107" r="6" fill="#ff88bb"/>
  <circle cx="216" cy="129" r="8" fill="#3399ff"/>
  <circle cx="296" cy="129" r="8" fill="#33ff99"/>
  <circle cx="186" cy="150" r="6" fill="#ff9944"/>
  <circle cx="326" cy="150" r="6" fill="#ff9944"/>
  <circle cx="256" cy="155" r="7" fill="#dd44ff"/>

  <!-- Sword (on shield) -->
  <rect x="249" y="168" width="14" height="115" rx="3" fill="#d4d4d4" stroke="#aaaaaa" stroke-width="1"/>
  <!-- Blade highlight -->
  <rect x="255" y="168" width="4" height="115" rx="2" fill="#f0f0f0" opacity="0.6"/>
  <!-- Crossguard -->
  <rect x="218" y="268" width="76" height="13" rx="6" fill="#ffd700"/>
  <!-- Handle -->
  <rect x="252" y="281" width="12" height="38" rx="4" fill="#8B4513"/>
  <rect x="252" y="281" width="6" height="38" rx="3" fill="#a05020" opacity="0.5"/>
  <!-- Pommel -->
  <circle cx="258" cy="326" r="11" fill="#ffd700" stroke="#ff9900" stroke-width="2"/>

  <!-- Sparkles -->
  <path d="M95 195 L101 210 L95 225 L89 210 Z" fill="#ffd700" opacity="0.85"/>
  <path d="M415 175 L420 187 L415 199 L410 187 Z" fill="#ffd700" opacity="0.85"/>
  <path d="M110 320 L115 330 L110 340 L105 330 Z" fill="#ff9900" opacity="0.7"/>
  <path d="M400 310 L405 320 L400 330 L395 320 Z" fill="#ff9900" opacity="0.7"/>

  <!-- Bottom title -->
  <text x="256" y="415" font-family="Georgia, serif" font-size="42" font-weight="bold"
        text-anchor="middle" fill="#ffd700" letter-spacing="3">KINGDOM</text>
  <text x="256" y="465" font-family="Georgia, serif" font-size="33" font-weight="bold"
        text-anchor="middle" fill="#b090ff" letter-spacing="5">QUEST</text>
</svg>`

async function main() {
  const svgBuffer = Buffer.from(svg)

  // Generate 512x512 PNG (used by Mac for .icns auto-conversion)
  const pngPath = path.join(buildDir, 'icon.png')
  await sharp(svgBuffer).resize(512, 512).png().toFile(pngPath)
  console.log('✅ Generated: build/icon.png')

  // Generate .ico manually using PNG-in-ICO format (Windows Vista+)
  // No extra packages needed — just sharp + manual ICO binary header
  const png256 = await sharp(svgBuffer).resize(256, 256).png().toBuffer()

  // ICO file = 6-byte header + 16-byte directory entry + raw PNG bytes
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)  // reserved
  header.writeUInt16LE(1, 2)  // type: 1 = ICO
  header.writeUInt16LE(1, 4)  // count: 1 image

  const dir = Buffer.alloc(16)
  dir.writeUInt8(0, 0)          // width (0 = 256)
  dir.writeUInt8(0, 1)          // height (0 = 256)
  dir.writeUInt8(0, 2)          // color count
  dir.writeUInt8(0, 3)          // reserved
  dir.writeUInt16LE(1, 4)       // color planes
  dir.writeUInt16LE(32, 6)      // bits per pixel
  dir.writeUInt32LE(png256.length, 8)  // size of image data
  dir.writeUInt32LE(22, 12)     // offset (6 header + 16 dir entry)

  fs.writeFileSync(path.join(buildDir, 'icon.ico'), Buffer.concat([header, dir, png256]))
  console.log('✅ Generated: build/icon.ico')
}

main().catch(err => {
  console.error('Icon generation failed:', err.message)
  process.exit(1)
})
