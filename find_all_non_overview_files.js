const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain';

function traverse(dir) {
    const files = fs.readdirSync(dir);
    for (let file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            traverse(fullPath);
        } else {
            // Log file info if it's not overview.txt
            if (file !== 'overview.txt') {
                console.log(`${fullPath} (${stat.size} bytes)`);
            }
        }
    }
}

traverse(brainDir);
console.log("Traversal complete.");
