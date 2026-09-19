const fs = require('fs');
const path = require('path');

const xmlPath = 'extracted_docx/word/document.xml';

if (!fs.existsSync(xmlPath)) {
    console.error("document.xml not found!");
    process.exit(1);
}

const content = fs.readFileSync(xmlPath, 'utf8');

// The text is wrapped in <w:t> tags in DOCX XML format
// We can use a regex to match <w:t>...</w:t> and join the matches
const matches = content.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);

if (matches) {
    const textArray = matches.map(m => {
        // Strip the tags
        const text = m.replace(/<[^>]+>/g, '');
        // Unescape common XML entities
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
    });
    
    const plainText = textArray.join('');
    fs.writeFileSync('comparison_text.txt', plainText, 'utf8');
    console.log("Extracted text length:", plainText.length);
    console.log("Snippet:");
    console.log(plainText.substring(0, 1000));
} else {
    console.log("No text tags found in XML.");
}
