const fs = require('fs');
const path = require('path');

const targetFile = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\673fb051-212e-4e27-ba08-ee90482bdc7a\\.tempmediaStorage\\dom_1783410032797.txt';

if (!fs.existsSync(targetFile)) {
    console.error("Target file does not exist.");
    process.exit(1);
}

const content = fs.readFileSync(targetFile, 'utf8');
console.log("Length:", content.length);
console.log("Snippet (start):", content.substring(0, 1000));
console.log("Snippet (end):", content.substring(content.length - 1000));

// Let's write it to recovered_index.html for analysis
fs.writeFileSync('recovered_dom.html', content, 'utf8');
console.log("Wrote content to recovered_dom.html");
