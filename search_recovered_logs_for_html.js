const fs = require('fs');

const recoveredLogsPath = 'recovered_logs.txt';

if (!fs.existsSync(recoveredLogsPath)) {
    console.error("recovered_logs.txt not found.");
    process.exit(1);
}

const content = fs.readFileSync(recoveredLogsPath, 'utf8');

// Search for index.html matches
let pos = 0;
let matchCount = 0;

while (true) {
    pos = content.indexOf('index.html', pos);
    if (pos === -1) break;
    
    console.log(`Match ${matchCount++} at pos ${pos}:`);
    const snippet = content.substring(Math.max(0, pos - 150), Math.min(content.length, pos + 300));
    console.log("-----------------------------------------");
    console.log(snippet);
    console.log("-----------------------------------------");
    
    pos += 10;
    if (matchCount > 30) {
        console.log("Stopping after 30 matches.");
        break;
    }
}
