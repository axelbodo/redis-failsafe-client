var net = require('net');
var util = require('util');
var logger = require('./logger');
var RedisCluster = require('../redis-cluster');
console.log('{'.charCodeAt(0))
var hashslot = require('../hashslot');
console.log(hashslot(new Buffer('fo{o')));
console.log(hashslot(new Buffer('{fo{o}')));
console.log(hashslot(new Buffer('123{fo{o}')));
console.log(hashslot(new Buffer('{fo{o}123')));
console.log(hashslot(new Buffer('foo')));
return;
var redis = new RedisCluster([
    {
        host: '127.0.0.1',
        port: 7006
    },
    {
        host: '127.0.0.1',
        port: 7001
    },
    {
        host: '127.0.0.1',
        port: 7002
    }
]);

var i = 0;
var j = 0;
var c;
var commands = 0;
function start() {
    if (c) clearTimeout(c);
    c = undefined;
    for (i = 0; i < 20000; i++) {
        if (j == 1 && i == 0) {
            j = 1;
        }
        redis.set('foo' + i, i, set(i));
        commands++;
        redis.get('foo' + i, get(i));
        commands++;
    }
}

function set(i) {
    return function (err, reply) {
        logger.log('set', i, reply, err);
        commands--;
        if (commands == 0) {
            j++;
            start();
        }
    }
};

function get(i) {
    return function(err, reply) {
        //if (reply != i) throw new Error(util.format('%d != %d', reply, i));
        logger.log('get', i);
        commands--;
        if (commands == 0) {
            j++;
            start();
        }
    }
};

function deltest(next) {
    redis.del('foo', function (err, reply) {
        logger.log('del', reply, err);
        hmsettest();
    });
}

function hmsettest() {
    redis.hmset('foo', 'a', 1, 'b', 2, 'c', 3, function (err, reply) {
        logger.log('hmset', reply, err);
        hmgettest();
    });
}

function hmgettest() {
    redis.hgetall('foo', function (err, reply) {
        logger.log('hgetall', reply, err);
		keys();
    });
}

function keys() {
	//TODO: on which node?
	//var con = redis.getConnection(12182);
	redis.keys(['foo*'], function (err, reply) {
        logger.log('keys', reply[0], err);
		setTimeout(function(){ keys(); }, 1000);
    });
}

function getRangeTest() {
	//TODO: on which node?
    redis.getrange('foo15123', 2, 3, function (err, reply) {
        logger.log('getrange', reply, err);
        redis.close(); //should end the executuon as al sockets should be unrefed
    });
}

function sentinel(job, err, reply) {
    if (err) {
        if (err.indexOf('CLUSTERDOWN') === 0) {
            if (job.retryCount > 4) {
                job.guarded('ERROR: ERETRYCOUNTEXCEEDED: ' + err);
                return;
            }
            job.connection.queue.unshift(job);
            job.connection.close();
            job.connection.emit('error', new Error(err));
            return;
        }
        //TODO: handle -ASK and -MOVE
    }
    job.guarded(err, reply);
}

function send(command, args, cb, connection, slot) {
    var length = args.length + 1;
    var content = "*" + length + '\r\n$' + command.length + '\r\n' + command + '\r\n';
    for (var i = 0; i < args.length; i++) {
        content += '$' + Buffer.byteLength(args[i]) + '\r\n' + args[i] + '\r\n';
    }
    var data = content;
    var job = {
        slot: slot,
        data : data,
        callback: function (err, reply) { sentinel(job, err, reply); },
        originalCommand: content,
        guarded: cb,
        retryCount: 0
    };
    if (!connection) {
        if (this.queue.length > 50000) { //TODO: make overflow configurable
            cb('ERROR: ECLUSTERQUEUEOVERFLOW');
        } else {
            this.queue.push(job);
        }
        return;
    }
    //console.log(connection.port);
    connection.write(job);
}

redis.on('ready', deltest);
