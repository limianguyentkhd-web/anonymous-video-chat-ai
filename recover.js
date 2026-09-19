const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain';
const outputHtmlPath = 'c:\\Users\\DELL\\Desktop\\thuctap\\index.html';

// We want to reconstruct index.html. We will collect all line number mappings we find in the logs.
const linesMap = {};

function scanFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        // Let's find patterns like: "1: <!DOCTYPE html>"
        // In the logs, it might escape HTML or have line endings.
        // Let's use a regex that matches "lineNum: lineContent"
        const regex = /(\d+): (<!DOCTYPE html>|<html|<head|<body|[\s\S]*?)(?=\r?\n\d+: |\r?\n"|\r?\n\s*"|\r?\n\}\]|\r?\n\{|$)/g;
        
        // A simpler way: split by newlines and inspect each line.
        const lines = content.split(/\r?\n/);
        for (let line of lines) {
            // Check if line starts with something like 1: or 123:
            const match = line.match(/^\s*(\\n)?(\d+):\s(.*)$/);
            if (match) {
                const lineNum = parseInt(match[2], 10);
                let lineText = match[3];
                // Clean up trailing carriage returns or JSON escapes if any
                lineText = lineText.replace(/\\r$/, '').replace(/\\n$/, '').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                
                // If we don't have this line yet, or it's longer (more complete), save it
                if (!linesMap[lineNum] || linesMap[lineNum].length < lineText.length) {
                    linesMap[lineNum] = lineText;
                }
            }
        }
    } catch (e) {
        console.error("Error reading file:", filePath, e.message);
    }
}

function traverse(dir) {
    const files = fs.readdirSync(dir);
    for (let file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            traverse(fullPath);
        } else if (file === 'overview.txt') {
            console.log("Scanning:", fullPath);
            scanFile(fullPath);
        }
    }
}

console.log("Starting recovery traversal...");
traverse(brainDir);

// Now let's see how many lines we recovered
const lineNumbers = Object.keys(linesMap).map(Number).sort((a, b) => a - b);
console.log(`Recovered ${lineNumbers.length} unique lines.`);

if (lineNumbers.length > 0) {
    const maxLine = Math.max(...lineNumbers);
    const htmlLines = [];
    for (let i = 1; i <= maxLine; i++) {
        if (linesMap[i] !== undefined) {
            htmlLines.push(linesMap[i]);
        } else {
            console.log(`Missing line ${i}, inserting empty line placeholder.`);
            htmlLines.push("");
        }
    }
    fs.writeFileSync(outputHtmlPath, htmlLines.join('\n'), 'utf8');
    console.log(`Reconstructed index.html written to ${outputHtmlPath}`);
} else {
    console.log("No lines could be recovered.");
}
