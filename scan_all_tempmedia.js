const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain';

function traverse(dir) {
    const files = fs.readdirSync(dir);
    for (let file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file === '.tempmediaStorage') {
                scanTempMedia(fullPath);
            } else {
                traverse(fullPath);
            }
        }
    }
}

function scanTempMedia(tempDir) {
    try {
        const files = fs.readdirSync(tempDir);
        for (let file of files) {
            const fullPath = path.join(tempDir, file);
            const stat = fs.statSync(fullPath);
            if (stat.size > 20000) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('<html') || content.includes('<!DOCTYPE') || content.includes('portal-grid')) {
                    console.log(`FOUND POTENTIAL HTML IN: ${fullPath} (${stat.size} bytes)`);
                    fs.writeFileSync(`recovered_dom_all_${path.basename(tempDir)}_${file}.html`, content, 'utf8');
                }
            }
        }
    } catch (e) {}
}

traverse(brainDir);
console.log("Scan of all temp media folders complete.");
