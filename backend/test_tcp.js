import net from 'net';
import dns from 'node:dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const shards = [
  'anushkastore-shard-00-00.w6bkfrk.mongodb.net',
  'anushkastore-shard-00-01.w6bkfrk.mongodb.net',
  'anushkastore-shard-00-02.w6bkfrk.mongodb.net',
];

for (const host of shards) {
  console.log(`Resolving ${host}...`);
  try {
    const addresses = await new Promise((resolve, reject) => {
      dns.resolve4(host, (err, addrs) => err ? reject(err) : resolve(addrs));
    });
    console.log(`Resolved ${host} ->`, addresses);

    for (const ip of addresses) {
      console.log(`Testing TCP connection to ${ip}:27017...`);
      const socket = new net.Socket();
      socket.setTimeout(4000);

      const connected = await new Promise((resolve) => {
        socket.connect(27017, ip, () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('error', (err) => {
          console.log(`TCP connection to ${ip}:27017 failed: ${err.message}`);
          socket.destroy();
          resolve(false);
        });
        socket.on('timeout', () => {
          console.log(`TCP connection to ${ip}:27017 timed out`);
          socket.destroy();
          resolve(false);
        });
      });

      console.log(`Connection to ${ip}:27017 success: ${connected}`);
    }
  } catch (err) {
    console.error(`Failed to resolve ${host}:`, err.message);
  }
}
