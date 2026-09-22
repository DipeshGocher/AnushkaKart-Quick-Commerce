import dns from 'node:dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

console.log("Resolving SRV record _mongodb._tcp.anushkastore.w6bkfrk.mongodb.net...");
dns.resolveSrv('_mongodb._tcp.anushkastore.w6bkfrk.mongodb.net', (err, addresses) => {
  if (err) {
    console.error("SRV lookup error:", err);
  } else {
    console.log("SRV addresses:", addresses);
  }
});
