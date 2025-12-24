/**
 * Increment build number before each build
 * Resets to 1 when version number changes
 */
const fs = require('fs');
const path = require('path');

const buildInfoPath = path.join(__dirname, '..', 'build-info.json');
const moduleJsonPath = path.join(__dirname, '..', 'module.json');

try {
  // Read current version from module.json
  const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
  const currentVersion = moduleJson.version;

  // Read existing build info
  let buildInfo = { buildNumber: 0, version: null };
  if (fs.existsSync(buildInfoPath)) {
    const content = fs.readFileSync(buildInfoPath, 'utf8');
    buildInfo = JSON.parse(content);
  }

  // Reset build number if version changed, otherwise increment
  if (buildInfo.version !== currentVersion) {
    buildInfo.buildNumber = 1;
    console.log(`Version changed to ${currentVersion}, resetting build number to 1`);
  } else {
    buildInfo.buildNumber = (buildInfo.buildNumber || 0) + 1;
    console.log(`Build number incremented to: ${buildInfo.buildNumber}`);
  }

  // Update version tracking
  buildInfo.version = currentVersion;

  fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2) + '\n');
} catch (error) {
  console.error('Failed to increment build number:', error);
  process.exit(1);
}
