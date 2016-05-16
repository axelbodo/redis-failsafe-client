var util = require('util');
var EventEmitter = require('events').EventEmitter;
var Connection = require('./connection').Connection;
var cluster_mod = require('./cluster'); var Cluster = cluster_mod.Cluster;

function RedisCluster(initialEndpoints) {
    this.initialEndpoints = [];
    this.currentIndex = 0;
    for (var index = 0; index < initialEndpoints.length; index++) {
        var initialEndpoint = initialEndpoints[index];
        var currentEndpoint = {
            host: initialEndpoint.host,
            port: initialEndpoint.port,
        };
        this.initialEndpoints[currentEndpoint.name] = currentEndpoint;
        this.initialEndpoints.push(currentEndpoint);
    }

    this.queue = [];
    bootstrap.call(this, this.initialEndpoints); //a way of private instance method call
};

util.inherits(RedisCluster, EventEmitter);
module.exports = RedisCluster;

function bootstrap(endpoints) {
    this.bootstrapping = true;
    var index = 0;
    var connection;
    var self = this;
    function next() {
        if (index > endpoints.length) {
            self.emit('error', new Error('ERROR: EBOOTSTRAPFAILED'));
            return;
        }
        var endpoint = endpoints[index];
        console.log('probing control connectiom:', endpoint.port);
        connection = new Connection(endpoint.host, endpoint.port);
        connection.write({data: 'cluster nodes\r\n', callback: parsecluster});
        index++;
        connection.once('error', next);
    }
    function parsecluster(err, reply) {
        if (err) next();
        var cluster = new Cluster(reply);
        self.controlConnection = connection;
        connection.removeListener('error', next);
        self.controlConnection.on('error',
            function(err) {
                onControlError.call(self, err);
        });
        initializeCluster.call(self, cluster);
    }

    next();
}

function onControlError(err) {
    this.clusterUpdating = true;
    this.controlConnection = undefined;
    var index = 0;
    var connection;
    var self = this;
    var endPoints = this.clusterConfig.nodes;
    function next() {
        if (index > endPoints.length) {
            self.emit('error', new Error('ERROR: ECLUSTERUNREACHABLE'));
            return;
        }
        var endpoint = endPoints[index];
        connection = new Connection(endpoint.host, endpoint.port);
        console.log('probing control connectiom:', endpoint.port);
        connection.write({data: 'cluster nodes\r\n', callback: parsecluster});
        index++;
        connection.once('error', next);
    }
    function parsecluster(err, reply) {
        if (err) next();
        var cluster = new Cluster(reply);
        self.controlConnection = connection;
        self.controlConnection.on('error',
            function (err) {
            onControlError.call(self, err);
        });
        initializeCluster.call(self, cluster);
    }
    
    next();
}

function onClusterNodeError(node, err) {
    var connection = node.connection;
    if (!connection) return;
    connection.queue.forEach(function (value) { this.push(value) }, this.queue);
    node.connection = undefined;
    updateCluster.call(this);
    this.clusterUpdating = true;
}

function updateCluster(forceUpdate) {
    if (this.clusterUpdating && !forceUpdate) return;
    var self = this;
    this.controlConnection.write({data: 'cluster nodes\r\n', callback: parsecluster});
    function parsecluster(err, reply) {
        if (err) onControlError.call(self, err);
        var cluster = new Cluster(reply);
        initializeCluster.call(self, cluster);
    }
}

function initializeCluster(cluster) {
    console.log('init cluster:', this.controlConnection.port);
    if(!this.clusterConfig)this.clusterConfig = cluster;
    this.slots = new Array(16384);
    for (var index = 0; index < cluster.nodes.length; index++) {
        var node = cluster.nodes[index];
        if (!this.clusterConfig.nodes[node.id]) {
            this.clusterConfig.nodes.push(node);
            this.clusterConfig.nodes[node.id] = node;
        }
        if (node.isMaster && !node.failed) {
            for (var rangeIndex = 0; rangeIndex < node.slots.length; rangeIndex++) {
                var range = node.slots[rangeIndex];
                if (range.indexOf('-<-') !== -1 || range.indexOf('->-') !== -1) continue; //TODO: importing or migrating slots. At this time we don't care about them.
                var rangeInterval = range.split('-');
                if (rangeInterval.length > 1) {
                    for (var i = +rangeInterval[0]; i <= +rangeInterval[1]; i++) {
                        this.slots[i] = node;
                    }
                } else {
                    this.slots[+rangeInterval[0]] = node;
                }
            }
        }
    }
    //TODO: handling possibly removed nodes
    var self = this;
    for (var i = 0; i < 16384; i++) {
        if (!this.slots[i]) {
            console.log('cluser is still shutdown:');
            setTimeout(function () { updateCluster.call(self, true); }, 1000);
            return;
        }
    }
    if (this.bootstrapping) {
        this.emit('ready');
        this.bootstrapping = false;
    }
    this.clusterUpdating = false;
    setTimeout(function() {
        while (self.queue.length > 0) {
            var job = self.queue.shift();
            job.retryCount++;
            self.getConnection(job.slot).write(job);
        }
    }, 1000);
}

RedisCluster.prototype.getConnection = function (slot) {
    //TODO: calculating slot
    var node = this.slots[slot];
    if (!node) {
        return undefined;
    }
    if (!node.connection) {
        node.connection = new Connection(node.host, node.port);
        var self = this;
        node.connection.on('error', function (connection, err) {
            onClusterNodeError.call(self, node, err);
        });
    }
    return node.connection;
}

RedisCluster.prototype.close = function () {
    if (this.controlConnection) this.controlConnection.close();
    for (var nodeindex = 0; nodeindex < this.clusterConfig.nodes.length; nodeindex++) {
        var node = this.clusterConfig.nodes[nodeindex];
        if (node.connection)node.connection.close();
    }
}

var commands = require('./commands');
for (var command in Object(commands)) {
    RedisCluster.prototype[command] = commands[command];
}

