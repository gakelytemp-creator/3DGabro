const fs = require('fs'), http = require('http'), https = require('https');
const { WebSocketServer } = require('ws');
const selfsigned = require('selfsigned');

(async () => {
  // სერტიფიკატი ერთხელ იქმნება და ინახება, რომ ტელეფონმა ყოველ ჯერზე არ იკითხოს
  let pem;
  if (fs.existsSync('cert.json')) pem = JSON.parse(fs.readFileSync('cert.json'));
  else {
    pem = await selfsigned.generate([{ name: 'commonName', value: 'phone-mouse' }],
      { keySize: 2048, algorithm: 'sha256', days: 365 });
    fs.writeFileSync('cert.json', JSON.stringify(pem));
  }

  const page = (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync('phone.html'));
  };
  const plain = http.createServer(page).listen(8080);                                  // კომპი: რედაქტორი
  const secure = https.createServer({ key: pem.private, cert: pem.cert }, page).listen(8443); // ტელეფონი

  const clients = new Set();
  let count = 0, last = '';
  for (const server of [plain, secure]) {
    new WebSocketServer({ server }).on('connection', (ws, req) => {
      clients.add(ws);
      console.log('+ connected', req.socket.remoteAddress, 'total', clients.size);
      ws.on('message', data => {
        count++; last = data.toString();
        for (const c of clients) if (c !== ws && c.readyState === 1) c.send(last);
      });
      ws.on('close', () => { clients.delete(ws); console.log('- closed, total', clients.size); });
    });
  }
  setInterval(() => { if (count) { console.log(count + ' msg/s', last); count = 0; } }, 1000);
  console.log('phone:  https://<PC-IP>:8443\neditor: ws://localhost:8080');
})();