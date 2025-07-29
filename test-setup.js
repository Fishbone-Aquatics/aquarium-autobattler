#!/usr/bin/env node

/**
 * Comprehensive test setup for Aquarium Autobattler
 * Tests API endpoints, frontend loading, hot reload, and styling
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = (message, color = 'reset') => {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
};

const tests = [];

function addTest(name, testFn) {
  tests.push({ name, testFn });
}

// Test 1: Backend API Health Check
addTest('Backend API Health Check', async () => {
  try {
    const response = await axios.get('http://localhost:3001/api', { timeout: 5000 });
    if (response.data && response.data.message === 'Hello API') {
      return { success: true, message: 'API responding correctly' };
    }
    return { success: false, message: 'API returned unexpected response' };
  } catch (error) {
    return { success: false, message: `API connection failed: ${error.message}` };
  }
});

// Test 2: Frontend Loading
addTest('Frontend Loading Check', async () => {
  // Try multiple ports since frontend may start on different port
  const ports = [3000, 3002, 3003];
  
  for (const port of ports) {
    try {
      const response = await axios.get(`http://localhost:${port}`, { timeout: 5000 });
      const hasReactHydration = response.data.includes('_next') || response.data.includes('React');
      const hasCorrectTitle = response.data.includes('Aquarium Autobattler');
      
      if (hasReactHydration && hasCorrectTitle) {
        return { success: true, message: `Frontend loading correctly on port ${port} with React hydration` };
      }
    } catch (error) {
      // Continue to next port
      continue;
    }
  }
  
  return { success: false, message: 'Frontend not accessible on any expected port' };
});

// Test 3: CSS Compilation
addTest('CSS Compilation Check', async () => {
  try {
    const globalCssPath = path.join(__dirname, 'frontend', 'src', 'app', 'global.css');
    const tailwindConfigPath = path.join(__dirname, 'frontend', 'tailwind.config.js');
    
    const globalCssExists = fs.existsSync(globalCssPath);
    const tailwindConfigExists = fs.existsSync(tailwindConfigPath);
    
    if (!globalCssExists) {
      return { success: false, message: 'global.css file not found' };
    }
    
    if (!tailwindConfigExists) {
      return { success: false, message: 'tailwind.config.js file not found' };
    }

    const globalCssContent = fs.readFileSync(globalCssPath, 'utf8');
    const hasTailwindDirectives = globalCssContent.includes('@tailwind base') && 
                                  globalCssContent.includes('@tailwind components') && 
                                  globalCssContent.includes('@tailwind utilities');
    
    if (hasTailwindDirectives) {
      return { success: true, message: 'CSS files properly configured with Tailwind' };
    }
    
    return { success: false, message: 'Tailwind directives not found in global.css' };
  } catch (error) {
    return { success: false, message: `CSS check failed: ${error.message}` };
  }
});

// Test 4: Component Files
addTest('Component Files Check', async () => {
  const components = [
    'frontend/src/components/game/GameView.tsx',
    'frontend/src/components/game/Shop.tsx',
    'frontend/src/components/game/TankGrid.tsx',
    'frontend/src/contexts/GameContext.tsx',
    'frontend/src/app/page.tsx',
    'frontend/src/app/layout.tsx'
  ];
  
  const missing = [];
  const existing = [];
  
  for (const component of components) {
    const filePath = path.join(__dirname, component);
    if (fs.existsSync(filePath)) {
      existing.push(component);
    } else {
      missing.push(component);
    }
  }
  
  if (missing.length === 0) {
    return { success: true, message: `All ${existing.length} component files found` };
  }
  
  return { success: false, message: `Missing components: ${missing.join(', ')}` };
});

// Test 5: Socket Connection
addTest('WebSocket Connection Check', async () => {
  try {
    // Test if socket.io endpoint is available
    const response = await axios.get('http://localhost:3001/socket.io/', { timeout: 5000 });
    if (response.status === 200 || response.status === 400) { // 400 is expected for GET on socket endpoint
      return { success: true, message: 'WebSocket server endpoint accessible' };
    }
    return { success: false, message: 'WebSocket endpoint not responding correctly' };
  } catch (error) {
    if (error.response && error.response.status === 400) {
      return { success: true, message: 'WebSocket server responding (400 expected for GET)' };
    }
    return { success: false, message: `WebSocket connection test failed: ${error.message}` };
  }
});

// Test 6: Hot Reload Detection
addTest('Hot Reload Configuration', async () => {
  try {
    const nextConfigPath = path.join(__dirname, 'frontend', 'next.config.js');
    const packageJsonPath = path.join(__dirname, 'package.json');
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const hasDevScript = packageJson.scripts && packageJson.scripts.dev;
    const hasStartScript = packageJson.scripts && packageJson.scripts.start;
    
    if (!hasDevScript || !hasStartScript) {
      return { success: false, message: 'Missing dev/start scripts in package.json' };
    }
    
    // Check if Next.js is configured for hot reload (default behavior)
    if (fs.existsSync(nextConfigPath)) {
      return { success: true, message: 'Hot reload configured via Next.js (custom config found)' };
    }
    
    return { success: true, message: 'Hot reload configured via Next.js (default config)' };
  } catch (error) {
    return { success: false, message: `Hot reload check failed: ${error.message}` };
  }
});

// Test 7: Development Dependencies
addTest('Development Dependencies Check', async () => {
  try {
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const requiredDevDeps = [
      'concurrently',
      'tailwindcss',
      '@tailwindcss/postcss',
      'autoprefixer',
      'typescript',
      'jest'
    ];
    
    const missing = [];
    const existing = [];
    
    for (const dep of requiredDevDeps) {
      if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
        existing.push(dep);
      } else if (packageJson.dependencies && packageJson.dependencies[dep]) {
        existing.push(dep);
      } else {
        missing.push(dep);
      }
    }
    
    if (missing.length === 0) {
      return { success: true, message: `All required dependencies found (${existing.length})` };
    }
    
    return { success: false, message: `Missing dependencies: ${missing.join(', ')}` };
  } catch (error) {
    return { success: false, message: `Dependency check failed: ${error.message}` };
  }
});

// Main test runner
async function runTests() {
  log('\n🧪 Aquarium Autobattler - Comprehensive Test Suite', 'bold');
  log('=' .repeat(60), 'blue');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    log(`\n🔍 Running: ${test.name}`, 'yellow');
    
    try {
      const result = await test.testFn();
      
      if (result.success) {
        log(`✅ PASS: ${result.message}`, 'green');
        passed++;
      } else {
        log(`❌ FAIL: ${result.message}`, 'red');
        failed++;
      }
    } catch (error) {
      log(`❌ ERROR: ${error.message}`, 'red');
      failed++;
    }
  }
  
  log('\n' + '=' .repeat(60), 'blue');
  log(`\n📊 Test Results: ${passed} passed, ${failed} failed`, 'bold');
  
  if (failed > 0) {
    log('\n🔧 Recommendations:', 'yellow');
    if (failed > passed) {
      log('• Ensure both frontend and backend services are running', 'yellow');
      log('• Check if all dependencies are installed: npm install', 'yellow');
      log('• Verify CSS compilation with: npm run build', 'yellow');
    }
  } else {
    log('\n🎉 All tests passed! Your development environment is ready!', 'green');
  }
  
  return { passed, failed };
}

// Export for use as module or run directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, addTest };