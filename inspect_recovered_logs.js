const fs = require('fs');

const recoveredLogsPath = 'recovered_logs.txt';

if (!fs.existsSync(recoveredLogsPath)) {
    console.error("recovered_logs.txt not found.");
    process.exit(1);
}

const content = fs.readFileSync(recoveredLogsPath, 'utf8');
console.log("Length of recovered_logs.txt:", content.length);

// Let's print out the first 500 characters and check for common patterns
console.log("=== START SNIPPET ===");
console.log(content.substring(0, 1000));
console.log("=== END SNIPPET ===");
console.log(content.substring(content.length - 1000));
