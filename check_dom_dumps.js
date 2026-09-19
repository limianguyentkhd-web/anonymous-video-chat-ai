const fs = require('fs');
const path = require('path');

const tempDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\673fb051-212e-4e27-ba08-ee90482bdc7a\\.tempmediaStorage';

if (!fs.existsSync(tempDir)) {
    console.error("Temp media storage not found!");
    process.exit(1);
}

const files = fs.readdirSync(tempDir);
const domFiles = files.filter(f => f.startsWith('dom_') && f.endsWith('.txt'));

for (let file of domFiles) {
    const fullPath = path.join(tempDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.size > 10000) {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Check if it is actually HTML
        if (content.includes('<html') || content.includes('<!DOCTYPE html>')) {
            console.log(`FOUND HTML DOM DUMP: ${file} (${stat.size} bytes)`);
            fs.writeFileSync(`recovered_dom_${file}.html`, content, 'utf8');
        }
    }
}

console.log("Scan complete.");
