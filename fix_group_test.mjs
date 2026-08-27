import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'server', 'tests', 'groups.unit.test.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix setHeader references
content = content.replace(/setHeader: \(\) => res,/g, "setHeader() { return this; },");

// Fix RFC 7807 problem+json checks
content = content.replace(/responseData\.error\.code/g, "responseData.title");
content = content.replace(/nonAdminRemoveResult\.error\.code/g, "nonAdminRemoveResult.title");
content = content.replace(/adminRemoveResult\.error\.code/g, "adminRemoveResult.title");
content = content.replace(/memberMsgResult\.error\.code/g, "memberMsgResult.title");
content = content.replace(/adminMsgResult\.error\.code/g, "adminMsgResult.title");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed groups.unit.test.ts');
