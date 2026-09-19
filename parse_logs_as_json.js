const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain';

function scanFile(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n');
        for (let line of lines) {
            if (!line.trim()) continue;
            try {
                const data = JSON.parse(line.trim());
                
                // Case 1: Tool call arguments for write_to_file or replace_file_content
                if (data.tool_calls) {
                    for (let call of data.tool_calls) {
                        if (call.name === 'write_to_file') {
                            const args = typeof call.args === 'string' ? JSON.parse(call.args) : call.args;
                            if (args.TargetFile && args.TargetFile.includes('index.html')) {
                                console.log(`[WRITE_TO_FILE] Found in ${filePath}, step ${data.step_index}`);
                                fs.writeFileSync(`recovered_write_${data.step_index}.html`, args.CodeContent, 'utf8');
                            }
                        }
                    }
                }
                
                // Case 2: Tool call in planner response (sometimes nested differently)
                if (data.content && data.content.includes('write_to_file')) {
                    // Let's see if we can parse the content if it's JSON
                    try {
                        const innerData = JSON.parse(data.content);
                        // handle nested if any
                    } catch (e) {}
                }
                
                // Case 3: View file output in USER_EXPLICIT step or TOOL_RESPONSE step
                if (data.type === 'VIEW_FILE' || data.content && data.content.includes('Showing lines')) {
                    if (data.content.includes('index.html')) {
                        console.log(`[VIEW_FILE] Found in ${filePath}, step ${data.step_index}`);
                        fs.writeFileSync(`recovered_view_${data.step_index}.txt`, data.content, 'utf8');
                    }
                }
            } catch (e) {
                // Not JSON or parsing error, ignore
            }
        }
    } catch (e) {
        // Read file error
    }
}

function traverse(dir) {
    const files = fs.readdirSync(dir);
    for (let file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            traverse(fullPath);
        } else if (file === 'overview.txt') {
            scanFile(fullPath);
        }
    }
}

traverse(brainDir);
console.log("JSON parsing of logs complete.");
