import net from 'net';
import https from 'https';

// 1. Get Public IP
https.get('https://api.ipify.org?format=json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("Your Public IP Address is:", JSON.parse(data).ip);
  });
});

// 2. Test TCP to Shards
const hosts = [
  'ac-q25rini-shard-00-00.w6bkfrk.mongodb.net',
  'ac-q25rini-shard-00-01.w6bkfrk.mongodb.net',
  'ac-q25rini-shard-00-02.w6bkfrk.mongodb.net'
];

for (const host of hosts) {
  const socket = new net.Socket();
  socket.setTimeout(5000);
  socket.connect(27017, host, () => {
    console.log(`Successfully connected to ${host}:27017 (Port is reachable!)`);
    socket.destroy();
  });
  socket.on('error', (err) => {
    console.log(`Failed to connect to ${host}:27017:`, err.message);
  });
  socket.on('timeout', () => {
    console.log(`Timeout connecting to ${host}:27017`);
    socket.destroy();
  });
}
