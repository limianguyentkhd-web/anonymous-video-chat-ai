const fs = require('fs');

const recoveredLogsPath = 'recovered_logs.txt';

if (!fs.existsSync(recoveredLogsPath)) {
    console.error("recovered_logs.txt not found.");
    process.exit(1);
}

const content = fs.readFileSync(recoveredLogsPath, 'utf8');

// Find all matches for "SafeConnect" (case insensitive)
let index = 0;
let count = 0;

while (true) {
    index = content.indexOf('SafeConnect', index);
    if (index === -1) break;
    
    console.log(`Match ${count++} at position ${index}:`);
    const snippet = content.substring(Math.max(0, index - 200), Math.min(content.length, index + 300));
    console.log("-----------------------------------------");
    console.log(snippet);
    console.log("-----------------------------------------");
    
    index += 11;
    if (count > 20) {
        console.log("Too many matches, stopping search.");
        break;
    }
}
