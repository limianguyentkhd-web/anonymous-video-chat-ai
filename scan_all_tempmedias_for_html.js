const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain';

function traverse(dir) {
    const files = fs.readdirSync(dir);
    for (let file of files) {
        const fullPath = path.join(dir, file);
        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                traverse(fullPath);
            } else {
                if (file.startsWith('dom_') && file.endsWith('.txt')) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const hasHtml = content.includes('<!DOCTYPE html') || content.includes('<html') || content.includes('<div id="app"');
                    const isStyles = content.includes('/* SafeConnect Premium Stylesheet */');
                    if (hasHtml && !isStyles) {
                        console.log(`FOUND REAL HTML DOM DUMP: ${fullPath} (${stat.size} bytes)`);
                        console.log("  Snippet:");
                        console.log(content.substring(0, 400).replace(/\r?\n/g, ' '));
                        console.log("--------------------------------------------------");
                    }
                }
            }
        } catch (e) {}
    }
}

traverse(brainDir);
console.log("Completed scan.");
