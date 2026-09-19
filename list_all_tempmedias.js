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
                if (file === '.tempmediaStorage') {
                    console.log(`Tempmedia folder: ${fullPath}`);
                    const subFiles = fs.readdirSync(fullPath);
                    for (let sf of subFiles) {
                        const sfp = path.join(fullPath, sf);
                        const sfs = fs.statSync(sfp);
                        console.log(`  - ${sf} (${sfs.size} bytes)`);
                    }
                } else {
                    traverse(fullPath);
                }
            }
        } catch (e) {}
    }
}

traverse(brainDir);
console.log("Completed.");
