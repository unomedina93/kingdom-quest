const { app, BrowserWindow, net, session } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const AdmZip = require('adm-zip')

const GITHUB_USER = 'unomedina93'
const GITHUB_REPO = 'kingdom-quest'
const GITHUB_RAW = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main`
const GITHUB_API = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}`

let mainWindow

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Kingdom Quest',
    backgroundColor: '#1a0a2e',
    show: false,
  })

  mainWindow.setMenu(null)

  // Grant camera/microphone permissions for motion games
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
    } else {
      callback(false)
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.maximize()
  })

  mainWindow.loadFile(getGamePath())

  // Check for updates silently in background
  setTimeout(() => checkForUpdates(), 3000)
}

function getGamePath() {
  const cached = path.join(app.getPath('userData'), 'game', 'index.html')
  if (fs.existsSync(cached)) return cached
  return path.join(__dirname, 'game', 'index.html')
}

function getLocalVersion() {
  const paths = [
    path.join(app.getPath('userData'), 'version.json'),
    path.join(__dirname, 'version.json'),
  ]
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8')).version
      }
    } catch {}
  }
  return '0.0.0'
}

function isNewer(remote, local) {
  const r = remote.split('.').map(Number)
  const l = local.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true
    if ((r[i] || 0) < (l[i] || 0)) return false
  }
  return false
}

async function checkForUpdates() {
  try {
    const body = await fetchText(`${GITHUB_RAW}/version.json`)
    const { version: remoteVersion } = JSON.parse(body)
    const localVersion = getLocalVersion()

    if (isNewer(remoteVersion, localVersion)) {
      console.log(`Update available: ${localVersion} → ${remoteVersion}`)
      await downloadUpdate(remoteVersion)
    } else {
      console.log(`Kingdom Quest is up to date (${localVersion})`)
    }
  } catch (err) {
    console.log('Update check skipped (probably offline):', err.message)
  }
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, headers: { 'User-Agent': 'KingdomQuestApp/1.0' } })
    let body = ''
    req.on('response', (res) => {
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => resolve(body))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    function get(u) {
      https.get(u, { headers: { 'User-Agent': 'KingdomQuestApp/1.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return get(res.headers.location)
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`))
        }
        const file = fs.createWriteStream(dest)
        res.pipe(file)
        file.on('finish', () => file.close(resolve))
        file.on('error', reject)
      }).on('error', reject)
    }
    get(url)
  })
}

async function downloadUpdate(newVersion) {
  const tmpZip = path.join(app.getPath('temp'), 'kq-update.zip')
  const gameDestPath = path.join(app.getPath('userData'), 'game')

  console.log('Downloading update...')
  await downloadFile(`${GITHUB_API}/zipball/main`, tmpZip)

  console.log('Extracting update...')
  const zip = new AdmZip(tmpZip)
  const entries = zip.getEntries()

  // Remove old cached game
  if (fs.existsSync(gameDestPath)) {
    fs.rmSync(gameDestPath, { recursive: true })
  }
  fs.mkdirSync(gameDestPath, { recursive: true })

  // GitHub zipball wraps files in: {user}-{repo}-{sha}/
  // We extract only files under the game/ subfolder
  for (const entry of entries) {
    const parts = entry.entryName.split('/')
    if (parts.length < 2) continue

    const relative = parts.slice(1).join('/') // strip first dir component
    if (!relative.startsWith('game/')) continue

    const fileRelative = relative.slice('game/'.length)
    if (!fileRelative) continue

    const destPath = path.join(gameDestPath, fileRelative)
    if (entry.isDirectory) {
      fs.mkdirSync(destPath, { recursive: true })
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      fs.writeFileSync(destPath, entry.getData())
    }
  }

  // Clean up zip
  try { fs.unlinkSync(tmpZip) } catch {}

  // Save new version
  fs.writeFileSync(
    path.join(app.getPath('userData'), 'version.json'),
    JSON.stringify({ version: newVersion }, null, 2)
  )

  console.log(`Update applied: ${newVersion}. Reloading game...`)

  // Reload the game window to show new version
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadFile(getGamePath())
  }
}
