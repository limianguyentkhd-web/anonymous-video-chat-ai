const fs = require('fs');

const recoveredLogsPath = 'recovered_logs.txt';
const content = fs.readFileSync(recoveredLogsPath, 'utf8');

const targetStr = '=== FOUND IN C:\\Users\\DELL\\.gemini\\antigravity\\brain\\b028d320-2bff-47d4-bfb3-ae707ba1ae54';
const startIdx = content.indexOf(targetStr);

if (startIdx === -1) {
    console.error("Target section not found!");
    process.exit(1);
}

console.log("Section starts at position:", startIdx);

// Find the next === FOUND IN or end of file
let nextIdx = content.indexOf('=== FOUND IN', startIdx + targetStr.length);
if (nextIdx === -1) {
    nextIdx = content.length;
}

console.log("Section ends at position:", nextIdx);
console.log("Section length:", nextIdx - startIdx);

const section = content.substring(startIdx, nextIdx);
fs.writeFileSync('b028d320_logs.txt', section, 'utf8');
console.log("Wrote section to b028d320_logs.txt");
