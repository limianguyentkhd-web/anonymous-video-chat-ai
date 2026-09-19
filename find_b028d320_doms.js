const fs = require('fs');
const path = require('path');

const targetDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\b028d320-2bff-47d4-bfb3-ae707ba1ae54';

function traverse(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (let file of files) {
        const fullPath = path.join(dir, file);
        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                traverse(fullPath);
            } else {
                if (file.startsWith('dom_') && file.endsWith('.txt')) {
                    console.log(`DOM Dump in b028d320: ${fullPath} (${stat.size} bytes)`);
                }
            }
        } catch (e) {}
    }
}

traverse(targetDir);
console.log("Scan of b028d320 complete.");
