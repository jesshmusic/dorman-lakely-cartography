/**
 * Increment build number before each build
 */
const fs = require('fs');
const path = require('path');

const buildInfoPath = path.join(__dirname, '..', 'build-info.json');

try {
  let buildInfo = { buildNumber: 0 };

  if (fs.existsSync(buildInfoPath)) {
    const content = fs.readFileSync(buildInfoPath, 'utf8');
    buildInfo = JSON.parse(content);
  }

  buildInfo.buildNumber = (buildInfo.buildNumber || 0) + 1;

  fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2) + '\n');

  console.log(`Build number incremented to: ${buildInfo.buildNumber}`);
} catch (error) {
  console.error('Failed to increment build number:', error);
  process.exit(1);
}
