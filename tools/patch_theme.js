const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'wechat-cloudbase-app/frontend/pages');
const pages = fs.readdirSync(pagesDir).filter(f => fs.statSync(path.join(pagesDir, f)).isDirectory());

for (const page of pages) {
  const pageDir = path.join(pagesDir, page);
  const wxmlPath = path.join(pageDir, 'index.wxml');
  let jsPath = path.join(pageDir, 'index.js');
  let tsPath = path.join(pageDir, 'index.ts');

  const scriptPath = fs.existsSync(tsPath) ? tsPath : fs.existsSync(jsPath) ? jsPath : null;

  if (fs.existsSync(wxmlPath)) {
    let wxml = fs.readFileSync(wxmlPath, 'utf8');
    if (!wxml.includes('{{themeClass}}')) {
      wxml = wxml.replace(/class="page([^"]*)"/, 'class="page$1 {{themeClass}}"');
      fs.writeFileSync(wxmlPath, wxml);
      console.log(`Updated ${page}/index.wxml`);
    }
  }

  if (scriptPath) {
    let script = fs.readFileSync(scriptPath, 'utf8');

    // Add getThemeClass import if missing
    if (!script.includes('getThemeClass')) {
      if (script.includes('require(\'../../store/index\')')) {
        script = script.replace(/(const\s+\{.*?)(\}\s*=\s*require\('\.\.\/\.\.\/store\/index'\))/, '$1, getThemeClass $2');
      } else if (script.includes('from \'../../store/index\'')) {
        script = script.replace(/(import\s+\{.*?)(\}\s*from\s*'..\/..\/store\/index')/, '$1, getThemeClass $2');
      } else {
        // Just inject it at the top
        if (scriptPath.endsWith('.ts')) {
          script = `import { getThemeClass } from '../../store/index'\n` + script;
        } else {
          script = `const { getThemeClass } = require('../../store/index')\n` + script;
        }
      }
    }

    // Add themeClass to data
    if (!script.includes('themeClass:')) {
      script = script.replace(/data:\s*\{/, 'data: {\n    themeClass: \'theme-default\',');
    }

    // Add to onShow
    if (!script.includes('themeClass: getThemeClass()')) {
      if (script.includes('onShow() {') || script.includes('onShow: function() {') || script.includes('async onShow() {')) {
        script = script.replace(/(onShow\(\)\s*\{|async onShow\(\)\s*\{|onShow:\s*function\(\)\s*\{)/, '$1\n    this.setData({ themeClass: getThemeClass() })');
      } else {
        // no onShow
        script = script.replace(/(data:\s*\{[^}]*\},\s*)/, '$1onShow() {\n    this.setData({ themeClass: getThemeClass() })\n  },\n  ');
      }
    }

    fs.writeFileSync(scriptPath, script);
    console.log(`Updated ${page}/index.${scriptPath.endsWith('.ts') ? 'ts' : 'js'}`);
  }
}
