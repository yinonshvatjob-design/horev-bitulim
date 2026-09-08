const https = require('https');

function check() {
  const req = https.request('https://horev-bitulim-1.onrender.com/api/admins', { method: 'GET' }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('Server is UP!');
        console.log('Admins:', d);
        if (d.includes('"ADMIN_DEV"')) {
          console.log('SUCCESS: ADMIN_DEV is in the live server!');
          process.exit(0);
        } else if (d.includes('"id":""')) {
          console.log('FAIL: Still has empty ID. Not restarted yet or DB overwritten.');
        } else {
          console.log('Waiting...');
        }
      } else {
        console.log('Server returned status:', res.statusCode);
      }
    });
  });
  req.on('error', err => {
    console.log('Server is DOWN (restarting...):', err.message);
  });
  req.end();
}

setInterval(check, 3000);
check();
