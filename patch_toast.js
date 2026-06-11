const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'wechat-cloudbase-app/frontend/pages');
const pages = fs.readdirSync(pagesDir).filter(f => fs.statSync(path.join(pagesDir, f)).isDirectory());

for (const page of pages) {
  const pageDir = path.join(pagesDir, page);
  const wxmlPath = path.join(pageDir, 'index.wxml');

  if (fs.existsSync(wxmlPath)) {
    let wxml = fs.readFileSync(wxmlPath, 'utf8');
    if (wxml.includes('<root-portal')) {
      // replace <view class="app-toast ..."> with <view class="app-toast ... {{themeClass}}">
      if (!wxml.includes('app-toast-{{appToastTone}} {{themeClass}}')) {
        wxml = wxml.replace(/class="app-toast app-toast-\{\{appToastTone\}\}"/, 'class="app-toast app-toast-{{appToastTone}} {{themeClass}}"');
        fs.writeFileSync(wxmlPath, wxml);
        console.log(`Updated root-portal in ${page}/index.wxml`);
      }
    }
  }
}
