// Test the actual API endpoint to see what it returns

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

// You'll need to get Joyce's actual token from the browser or generate one
// For now, let's just show instructions
console.log('To test the API endpoint:');
console.log('1. Log in as Joyce (joyce@yahoo.com) in the browser');
console.log('2. Open browser DevTools > Application > Local Storage');
console.log('3. Find the "token" value and copy it');
console.log('4. Then run this in the browser console:');
console.log('');
console.log(`fetch('/api/notes', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
}).then(r => r.json()).then(notes => {
  console.log('Total notes:', notes.length);
  const byUser = {};
  notes.forEach(n => byUser[n.user_id] = (byUser[n.user_id] || 0) + 1);
  console.log('By user:', byUser);
  console.log('Sample notes:', notes.slice(0, 10).map(n => ({
    user_id: n.user_id,
    title: n.title
  })));
});`);
