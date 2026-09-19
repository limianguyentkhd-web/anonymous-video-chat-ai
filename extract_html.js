const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain';
const outputFile = 'c:\\Users\\DELL\\Desktop\\thuctap\\recovered_logs.txt';

let outputContent = "";

function searchInFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        // Let's find index.html view outputs
        let pos = 0;
        while (true) {
            pos = content.indexOf('index.html', pos);
            if (pos === -1) break;
            
            // Check if it's a view_file output (contains "Total Lines: ")
            const snippet = content.substring(Math.max(0, pos - 200), Math.min(content.length, pos + 4000));
            if (snippet.includes("Total Lines:") || snippet.includes("DOCTYPE html") || snippet.includes("card-header border-bottom")) {
                outputContent += `=== FOUND IN ${filePath} ===\n${snippet}\n=================================\n\n`;
            }
            pos += 10;
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
fs.writeFileSync(outputFile, outputContent, 'utf8');
console.log("Extraction complete. Results written to:", outputFile);
