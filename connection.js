var net = require('net');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var Parser = require('./parser').Parser;

function  Connection(host, port) {
    this.queue = [];
    this.parser = new Parser();
    this.port = port;
    
    this.stream = net.createConnection({ port: port, host: host });
    EventEmitter.call(this);

    var self = this;
    this.stream.on('connect', function () {
        //console.log('connected');
        self.onConnect();
    });
    this.stream.on('data', function (data) {
        self.onData(data);
    });
    this.stream.on('error', function (err) {
        self.onError(err);
    });
    this.stream.on('close', function (err) {
        var i = 0;
    });
    this.stream.on('end', function (err) {
        var i = 0;
    });
    this.stream.on('drain', function (err) {
        var i = 0;
    });
    this.parser.on('response', function(err, reply) { self.onResponse(err, reply); });
}

module.exports.Connection = Connection;
util.inherits(Connection, EventEmitter);

Connection.prototype.onError = function(err) {
    this.connected = false;
    this.emit('error', this, err);
}

Connection.prototype.onConnect = function () {
    this.connected = true;
    this.stream.setKeepAlive(true);
    this.stream.setTimeout(0);
    this.stream.setNoDelay();
    var self = this;
    for (var i = 0; i < this.queue.length; i++) {
        try {
            var written = this.stream.write(this.queue[i].data, function (data) {
                return function () {
                    //console.log('written:', data, i);
                }
            }(this.queue[i].data));
            if (!written) {
                this.hasowerflow = job.originalCommand;
            }
        } catch (ex) {
            ex = ex;
        }
    }
}

Connection.prototype.onData = function (data) {
    this.parser.processInputBuffer(data);
}

Connection.prototype.onResponse = function (err, reply) {
    this.queue.shift().callback(err, reply);
}

Connection.prototype.write = function (job) {
    if (this.queue.length > 50000) { //TODO: make overflow configurable
        job.callback('ERROR: ECONNECTIONQUEUEOVERFLOW');
        return;
    }
    job.connection = this;
    this.queue.push(job);
    if (!this.connected) return;
    var written = this.stream.write(job.data, 'utf8', function () {
        //console.log('written:', job.data);
    });
    if (!written) {
        this.hasowerflow = job.originalCommand;
    }
}

Connection.prototype.close = function (job) {
    if (!this.stream) return;
    this.stream.destroy();
    this.parser.close();
}
