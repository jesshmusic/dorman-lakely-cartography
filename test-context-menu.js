/**
 * Test script to diagnose context menu issues
 * Paste this into the browser console AFTER Foundry has loaded
 */

console.log("Dorman | === Context Menu Diagnostic Test ===");

// 1. Check Foundry version
console.log("Dorman | Foundry Version:", game.version);

// 2. Check if module is active
const module = game.modules.get('dorman-lakely-cartography');
console.log("Dorman | Module active:", module?.active);
console.log("Dorman | Module version:", module?.version);

// 3. Check if user is GM
console.log("Dorman | User is GM:", game.user?.isGM);

// 4. Check if JSZip is available
console.log("Dorman | JSZip available:", typeof JSZip !== 'undefined');

// 5. List all hooks that fire when right-clicking a scene
console.log("Dorman | === Registering test hooks ===");

// Test all possible hook names
const hookNames = [
  'getSceneDirectoryEntryContext',
  'getSceneDirectoryContext',
  'getDirectoryEntryContext',
  'getContextMenuOptions',
  'renderContextMenu'
];

hookNames.forEach(hookName => {
  Hooks.on(hookName, (...args) => {
    console.log(`Dorman | ✓ Hook fired: ${hookName}`);
    console.log("Dorman |   Args:", args.length);
    console.log("Dorman |   First arg:", args[0]);
    console.log("Dorman |   Second arg:", args[1]);
  });
});

console.log("Dorman | === Now right-click a scene and see which hooks fire ===");
console.log("Dorman | Look for ✓ messages above");
