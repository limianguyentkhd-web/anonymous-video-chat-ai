const fs = require('fs');

const candidatesPath = 'candidate_blocks.txt';
const outputPath = 'index.html';

if (!fs.existsSync(candidatesPath)) {
    console.error("Candidates file not found!");
    process.exit(1);
}

const content = fs.readFileSync(candidatesPath, 'utf8');

// We split by both literal newlines and escaped newlines (\n or \\n)
const lines = content.split(/\\n|\r?\n/);

const linesMap = {};

for (let line of lines) {
    // Match line number and content, e.g. "123: <div>" or "  123: <div>"
    // Also handle possible escape characters or quotes
    const match = line.match(/^\s*(\d+):\s(.*)$/);
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
            .replace(/\"$/, '') // Remove trailing quote if it was the end of a JSON string
            .replace(/^\"/, ''); // Remove leading quote

        // Keep the longest/most complete version of the line
        if (!linesMap[lineNum] || linesMap[lineNum].length < lineText.length) {
            linesMap[lineNum] = lineText;
        }
    }
}

const lineNumbers = Object.keys(linesMap).map(Number).sort((a, b) => a - b);
console.log(`Extracted ${lineNumbers.length} lines.`);

if (lineNumbers.length > 0) {
    const maxLine = Math.max(...lineNumbers);
    console.log(`Max line number found: ${maxLine}`);
    
    // Let's check for gaps
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
    
    console.log(`Gaps: ${gaps.length} lines missing.`);
    if (gaps.length > 0) {
        console.log(`Missing lines: ${gaps.slice(0, 50).join(', ')}${gaps.length > 50 ? '...' : ''}`);
    }
    
    fs.writeFileSync(outputPath, finalLines.join('\n'), 'utf8');
    console.log(`Reconstructed file written to ${outputPath}`);
} else {
    console.log("No lines extracted.");
}
