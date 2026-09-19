const fs = require('fs');

const logPath = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\673fb051-212e-4e27-ba08-ee90482bdc7a\\.system_generated\\logs\\overview.txt';

if (!fs.existsSync(logPath)) {
    console.error("Log file not found!");
    process.exit(1);
}

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

const types = {};
for (let line of lines) {
    if (!line.trim()) continue;
    try {
        const data = JSON.parse(line.trim());
        types[data.type] = (types[data.type] || 0) + 1;
    } catch (e) {}
}

console.log("Types of steps found:", types);
