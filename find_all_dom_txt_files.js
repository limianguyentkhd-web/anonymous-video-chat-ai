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
                    console.log(`DOM Dump: ${fullPath} (${stat.size} bytes)`);
                }
            }
        } catch (e) {}
    }
}

traverse(brainDir);
console.log("Traversal complete.");
