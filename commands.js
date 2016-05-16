var hashslot = require('./hashslot');
function get(key, cb) {
    var slot = hashslot(new Buffer(key));
    //var slot = 12182;
    var connection = this.getConnection(slot);
    send('get', [key], cb, connection, slot);
}

function set(key, value, cb) {
    var slot = hashslot(new Buffer(key));
    var connection = this.getConnection(slot);
    send('set', [key, value], cb, connection, slot);
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
module.exports.get = get;
module.exports.set = set;

