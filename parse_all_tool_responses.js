const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\673fb051-212e-4e27-ba08-ee90482bdc7a\\.system_generated\\logs\\overview.txt';

if (!fs.existsSync(logPath)) {
    console.error("Log file not found!");
    process.exit(1);
}

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

const linesMap = {};

for (let line of lines) {
    if (!line.trim()) continue;
    try {
        const data = JSON.parse(line.trim());
        if (data.content) {
            // Check if the content is a file view by looking for lines like "1: <!DOCTYPE html>"
            // or "Total Lines:" or similar
            const innerLines = data.content.split(/\r?\n/);
            for (let innerLine of innerLines) {
                const match = innerLine.match(/^\s*(\d+):\s(.*)$/);
                if (match) {
                    const lineNum = parseInt(match[1], 10);
                    let lineText = match[2];
                    
                    // Clean up JSON escaping
                    lineText = lineText
                        .replace(/\\"/g, '"')
                        .replace(/\\'/g, "'")
                        .replace(/\\\\/g, '\\')
                        .replace(/\\t/g, '\t')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/\\r$/, '')
                        .replace(/\"$/, '') 
                        .replace(/^\"/, '');

                    // Let's store the line
                    if (!linesMap[lineNum] || linesMap[lineNum].length < lineText.length) {
                        linesMap[lineNum] = lineText;
                    }
                }
            }
        }
    } catch (e) {
        // Ignore JSON parse errors
    }
}

const lineNumbers = Object.keys(linesMap).map(Number).sort((a, b) => a - b);
console.log(`Successfully extracted ${lineNumbers.length} unique lines!`);

if (lineNumbers.length > 0) {
    const maxLine = Math.max(...lineNumbers);
    console.log(`Max line number: ${maxLine}`);
    
    const gaps = [];
    const finalLines = [];
    for (let i = 1; i <= maxLine; i++) {
        if (linesMap[i] !== undefined) {
            finalLines.push(linesMap[i]);
        } else {
            gaps.push(i);
            finalLines.push(`<!-- MISSING LINE ${i} -->`);
        }
    }
    
    console.log(`Gaps count: ${gaps.length}`);
    if (gaps.length > 0) {
        console.log(`Gaps (first 100): ${gaps.slice(0, 100).join(', ')}`);
    }
    
    fs.writeFileSync('reconstructed_current_index.html', finalLines.join('\n'), 'utf8');
    console.log("Wrote reconstructed index to reconstructed_current_index.html");
}
