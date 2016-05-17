var fs = require('fs');

function log() {
    var message = new Date().toISOString();

    for (var i = 0; i < arguments.length; i++) {
        message += ' ' + arguments[i];
    }
    fs.appendFileSync('test.log', message + '\r\n')
    console.log.call(console, message);
}

exports.log = log;