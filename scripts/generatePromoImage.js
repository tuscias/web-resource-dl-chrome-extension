const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Function to generate promotional image
function generatePromoImage() {
    const canvas = createCanvas(440, 280);
    const ctx = canvas.getContext('2d');
    
    // Draw green rectangle background
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, 440, 280);
    
    // Draw white dot in the center
    ctx.beginPath();
    const centerX = 440 / 2;
    const centerY = 280 / 2;
    const radius = 40;  // larger dot for the promo image
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    
    // Save the image
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(__dirname, '..', 'misc', 'promo-440x280.png'), buffer);
    console.log('Generated promo-440x280.png');
}

// Function to generate square icon
function generateSquareIcon() {
    const canvas = createCanvas(128, 128);
    const ctx = canvas.getContext('2d');
    
    // Draw green rectangle background
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, 128, 128);
    
    // Draw white dot in the center
    ctx.beginPath();
    const centerX = 128 / 2;
    const centerY = 128 / 2;
    const radius = 20;  // smaller dot for the square icon
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    
    // Save the image
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(__dirname, '..', 'misc', 'promo-128x128.png'), buffer);
    console.log('Generated promo-128x128.png');
}

generatePromoImage();
generateSquareIcon();
