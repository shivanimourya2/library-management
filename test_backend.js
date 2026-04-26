const http = require('http');

const postData = JSON.stringify({
  email: 'aarav@kgce.edu',
  password: 'pass123'
});

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Login Response:', data);
    const loginRes = JSON.parse(data);
    if (loginRes.success) {
      const token = loginRes.data.token;
      const userId = loginRes.data.user.id;
      
      const fineData = JSON.stringify({
        userId: userId,
        daysOverdue: 20
      });
      
      const fineOptions = {
        hostname: 'localhost', port: 8080, path: '/api/fines/calculate', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': fineData.length, 'Authorization': 'Bearer ' + token }
      };
      
      const fineReq = http.request(fineOptions, (fineRes) => {
        let fineResult = '';
        fineRes.on('data', (c) => fineResult += c);
        fineRes.on('end', () => {
          console.log('Fine Calculation Response:', fineResult);
        });
      });
      fineReq.write(fineData);
      fineReq.end();
    }
  });
});

req.on('error', (e) => { console.error('Error:', e); });
req.write(postData);
req.end();
