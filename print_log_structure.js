const fs = require('fs');

const logPath = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\673fb051-212e-4e27-ba08-ee90482bdc7a\\.system_generated\\logs\\overview.txt';

if (!fs.existsSync(logPath)) {
    console.error("Log file not found!");
    process.exit(1);
}

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

let count = 0;
for (let line of lines) {
    if (!line.trim()) continue;
    try {
        const data = JSON.parse(line.trim());
        console.log(`Step ${data.step_index} | Type: ${data.type} | Keys: ${Object.keys(data).join(', ')}`);
        if (data.type === 'TOOL_RESPONSE' || data.source === 'TOOL') {
            console.log("  Tool Response Snippet:", JSON.stringify(data).substring(0, 300));
        }
        count++;
        if (count > 20) break;
    } catch (e) {
        console.log("Failed to parse line:", line.substring(0, 100));
    }
}
