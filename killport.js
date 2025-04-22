const { execSync } = require('child_process');
const os = require('os');

function killPortProcess(port) {
  try {
    console.log(`Attempting to kill processes on port ${port}...`);
    
    let command;
    if (os.platform() === 'win32') {
      // Windows
      command = `FOR /F "tokens=5" %P IN ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') DO taskkill /F /PID %P`;
      try {
        execSync(command, { shell: 'cmd.exe', stdio: 'inherit' });
      } catch (e) {
        console.log('No process found or unable to kill process. Continuing...');
      }
    } else {
      // Unix-like (Linux, macOS)
      command = `lsof -i :${port} | grep LISTEN | awk '{print $2}' | xargs kill -9`;
      try {
        execSync(command);
      } catch (e) {
        console.log('No process found or unable to kill process. Continuing...');
      }
    }
    
    console.log(`Any processes on port ${port} should now be terminated.`);
  } catch (error) {
    console.error(`Error killing process on port ${port}:`, error.message);
  }
}

// Kill process on port 3000 
killPortProcess(3000);

console.log('You can now start your server on port 3000.'); 