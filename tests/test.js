var net = require('net');
var util = require('util');
var logger = require('./logger');
var RedisCluster = require('../redis-cluster');
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

function deltest() {
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
    });
}

redis.on('ready', deltest);
