const fs = require('fs');
const path = require('path');

const tempDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\673fb051-212e-4e27-ba08-ee90482bdc7a\\.tempmediaStorage';

if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    console.log(`Total files in current tempmedia: ${files.length}`);
    for (let file of files) {
        const fullPath = path.join(tempDir, file);
        const stat = fs.statSync(fullPath);
        if (stat.size > 10000) {
            // Check if it is a text file or binary
            const content = fs.readFileSync(fullPath, 'utf8');
            const isPng = content.startsWith('\x89PNG');
            if (!isPng) {
                console.log(`File: ${file} | Size: ${stat.size} bytes`);
                console.log("  Starts with:", content.substring(0, 150).replace(/\r?\n/g, ' '));
                const hasDivs = content.includes('<div') || content.includes('<body');
                console.log("  Has real HTML divs:", hasDivs);
                if (hasDivs) {
                    fs.writeFileSync(`recovered_current_html_${file}.html`, content, 'utf8');
                    console.log(`  => Copied to recovered_current_html_${file}.html`);
                }
            }
        }
    }
} else {
    console.log("Current tempmedia folder not found.");
}
