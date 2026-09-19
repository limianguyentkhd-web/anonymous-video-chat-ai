const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain';

function searchInFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('<!DOCTYPE html>')) {
            console.log("FOUND in:", filePath);
            // Print a small sample
            const idx = content.indexOf('<!DOCTYPE html>');
            console.log(content.substring(idx - 50, idx + 200));
        }
    } catch (e) {}
}

function traverse(dir) {
    const files = fs.readdirSync(dir);
    for (let file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            traverse(fullPath);
        } else if (file === 'overview.txt') {
            searchInFile(fullPath);
        }
    }
}

traverse(brainDir);
console.log("Scan complete.");
