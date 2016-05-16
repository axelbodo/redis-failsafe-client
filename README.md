# redis-failsafe-client
A redis client for redis clusters, which recovers in case of cluster failover or rehashing.

```javascript
var redis = require('redis-failsafe-client');

var client = new RedisCluster({[
    {host: 'localhost', port: 7001},
    {host: 'localhost', port: 7002},
    {host: 'localhost', port: 7003},
    {host: 'localhost', port: 7004}
]});

function test() {
    client.set('foo', 'bar', function (err, reply){
        console.log(err ? err : reply);
    });
    client.get('foo', function (err, reply){
        console.log(err ? err : reply);
    });
}

client.on('ready', test);
```