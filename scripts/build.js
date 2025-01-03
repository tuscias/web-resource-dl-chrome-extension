const fs = require('fs-extra');
const archiver = require('archiver');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '../build');
const DIST_DIR = path.join(__dirname, '../dist');
const SOURCE_DIR = path.join(__dirname, '../src');

// Files and directories to include in the package
const FILES_TO_COPY = [
  'manifest.json',
  'js',
  'css',
  'html',
  'icons'
];

async function build() {
  try {
    // Clean build and dist directories
    await fs.remove(BUILD_DIR);
    await fs.remove(DIST_DIR);
    await fs.ensureDir(BUILD_DIR);
    await fs.ensureDir(DIST_DIR);

    // Copy files to build directory
    for (const file of FILES_TO_COPY) {
      const sourcePath = path.join(SOURCE_DIR, file);
      const targetPath = path.join(BUILD_DIR, file);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, targetPath);
      } else {
        console.warn(`Warning: ${file} not found`);
      }
    }

    // Create zip file
    const output = fs.createWriteStream(path.join(DIST_DIR, 'extension.zip'));
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    archive.pipe(output);

    // Add the build directory contents to the zip
    archive.directory(BUILD_DIR, false);

    await archive.finalize();

    console.log('Build completed successfully!');
    console.log(`Extension package created at: ${path.join(DIST_DIR, 'extension.zip')}`);

  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
