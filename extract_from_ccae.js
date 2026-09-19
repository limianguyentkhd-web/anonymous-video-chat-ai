const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\ccae0f15-d6ee-4111-9418-a1bd386bde8d\\.system_generated\\logs\\overview.txt';

if (!fs.existsSync(logPath)) {
    console.error("Target log not found:", logPath);
    process.exit(1);
}

const logContent = fs.readFileSync(logPath, 'utf8');

// Find the write_to_file of index.html
// We search for targetFile /index.html and write_to_file
let index = 0;
let foundBlocks = [];

while (true) {
    index = logContent.indexOf('index.html', index);
    if (index === -1) break;
    
    // Grab a block around it to check if it's a write_to_file call with CodeContent
    const start = Math.max(0, index - 500);
    const end = Math.min(logContent.length, index + 300000); // index.html is big, so grab up to 300KB
    const snippet = logContent.substring(start, end);
    
    if (snippet.includes('write_to_file') && snippet.includes('CodeContent')) {
        console.log("Found a write_to_file block at pos:", index);
        // Let's parse out the CodeContent
        // We'll look for "CodeContent":"..." or similar JSON format
        // Since it's JSON, the value of CodeContent is a string.
        const match = snippet.match(/"CodeContent"\s*:\s*"([\s\S]*?)(?=",\s*"Description"|",\s*"IsArtifact")/);
        if (match) {
            let code = match[1];
            // Unescape the JSON string
            code = code
                .replace(/\\r\\n/g, '\n')
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\');
            foundBlocks.push(code);
            console.log("Successfully extracted code block. Length:", code.length);
        }
    }
    index += 10;
}

if (foundBlocks.length > 0) {
    // Write the largest found code block to index.html
    foundBlocks.sort((a, b) => b.length - a.length);
    const bestCode = foundBlocks[0];
    fs.writeFileSync('index.html', bestCode, 'utf8');
    console.log("Successfully restored index.html base from conversation ccae0f15!");
} else {
    console.log("Could not extract index.html from ccae0f15.");
}
