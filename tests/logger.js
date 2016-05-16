var fs = require('fs');

function log() {
    var message = Date.now();

    for (var i = 0; i < arguments.length; i++) {
        message += arguments[i] + ' ';
    }
    fs.appendFileSync('test.log', message + '\r\n')
    console.log.apply(console, arguments);
}

exports.log = log;