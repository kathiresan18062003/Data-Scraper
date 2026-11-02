const fs = require('fs');
['frontend/node_modules', 'node_modules'].forEach(p => {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
  }
});

