const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\673fb051-212e-4e27-ba08-ee90482bdc7a\\.system_generated\\logs\\overview.txt';

if (!fs.existsSync(logPath)) {
    console.error("Log file not found!");
    process.exit(1);
}

const content = fs.readFileSync(logPath, 'utf8');

// The log contains JSON lines or blocks. Let's find tool calls and outputs.
// Since the file is large, we can parse it as a JSON array if it's formatted as JSON,
// or we can find matching sections using regular expressions.
// Let's search for "c:\\Users\\DELL\\Desktop\\thuctap\\index.html" or "index.html"
// and extract the "content" or "tool_returns" fields.

// We will split by typical JSON message boundaries.
// Usually, each message is in a format like: {"step_index":..., "content":"..."}
// Let's find occurrences of "index.html" and view their surrounding braces.

let pos = 0;
const results = [];

while (true) {
    pos = content.indexOf('index.html', pos);
    if (pos === -1) break;
    
    // Find the enclosing JSON object. We can scan backward to '{' and forward to '}'
    let start = pos;
    let braceCount = 0;
    while (start >= 0) {
        if (content[start] === '{') {
            braceCount++;
            // We want to find the outermost '{'
            // For safety, let's just go back until we see a newline followed by '{"' or similar.
            if (content.substring(start - 1, start + 2) === '\n{"' || start === 0) {
                break;
            }
        }
        start--;
    }
    if (start < 0) start = 0;
    
    let end = pos;
    while (end < content.length) {
        if (content[end] === '\n' && content.substring(end, end + 2) === '\n{') {
            break;
        }
        end++;
    }
    
    const block = content.substring(start, end);
    results.push(block);
    pos = end + 1;
}

console.log(`Found ${results.length} candidate blocks.`);
fs.writeFileSync('candidate_blocks.txt', results.join('\n\n=====================================\n\n'), 'utf8');
console.log("Written candidate blocks to candidate_blocks.txt");
