var util = require('util');
var EventEmitter = require('events').EventEmitter;

function Parser() {
    this.parseBuffer = new Buffer(0);
    this.offset = 0;
}

util.inherits(Parser, EventEmitter);
module.exports.Parser = Parser;

Parser.prototype.processInputBuffer = function (data) {
    //console.log(data.toString());
    if (this.offset >= this.parseBuffer.length) {
        this.parseBuffer = data;
    } else {
        this.parseBuffer = Buffer.concat([this.parseBuffer.slice(this.offset), data]);
    }
    this.offset = 0;
    var finished;
    while (true) {
        if (this.closed) {
            return;
        }
        if (this.parseBuffer.length <= this.offset) return;
        var offset = this.offset;
        var result = [];
        if (this.parseBuffer[this.offset] == 36) { //$
            this.offset++;
            finished = this.parseString(result);
            if (finished) {
                this.emit('response', undefined, result[0]);
            }
        } else if (this.parseBuffer[this.offset] == 42) { //*
            this.offset++;
            finished = this.parseList(result);
            if (finished) {
                this.emit('response', undefined, result[0]);
            }
        } else if (this.parseBuffer[this.offset] == 45) { //-
            this.offset++;
            finished = this.parseMessage(result);
            if (finished) {
                this.emit('response', result[0]);
            }
        } else if (this.parseBuffer[this.offset] == 43) { //+
            this.offset++;
            finished = this.parseMessage(result);
            if (finished) {
                this.emit('response', undefined, result[0]);
            }
        } else if (this.parseBuffer[this.offset] == 58) { //:
            this.offset++;
            finished = this.parseInt(result);
            if (finished) {
                this.emit('response', undefined, result[0]);
            }
        } else {
            //TODO: error handling
            var i = 0;
            i = 1;
        }
        if (!finished) {
            this.offset = offset;
            return;
        }
    }
}

Parser.prototype.parseString = function (result) {
    var length = -1;
    for (var i = this.offset; i < this.parseBuffer.length; i++) {
        if (this.parseBuffer[i] == 10) {
            length = +this.parseBuffer.toString('ascii', this.offset, i - 1);
            break;
        }
    }
    var offset = i + 1;
    if (i == this.parseBuffer.length) return 0;
    if (length == -1) {
        result.push(undefined);
        this.offset = offset;
        return 1;
    }
    if (this.parseBuffer.length - offset < length + 2) return 0;
    result.push(this.parseBuffer.toString('ascii', offset, offset + length));
    this.offset = offset + length + 2;
    return 1;
}

Parser.prototype.parseInt = function (result) {
    for (var i = this.offset; i < this.parseBuffer.length; i++) {
        if (this.parseBuffer[i] == 10) {
            break;
        }
    }
    if (i == this.parseBuffer.length) return 0;
    result.push(+this.parseBuffer.toString('ascii', this.offset, i - 1));
    this.offset = i + 1;
    return 1;
}

Parser.prototype.parseList = function (result) {
    var length = -1;
    for (var i = this.offset; i < this.parseBuffer.length; i++) {
        if (this.parseBuffer[i] == 10) {
            length = +this.parseBuffer.toString('ascii', this.offset, i - 1);
            break;
        }
    }
    this.offset = i + 1;
    var list = [];
    for (i = 0; i < length; i++) {
        var finished = this.parse(list);
        if (!finished) return finished;
    }
    result.push(list);
    return 1;
}

Parser.prototype.parseMessage = function (result) {
    for (var i = this.offset; i < this.parseBuffer.length; i++) {
        if (this.parseBuffer[i] == 10) {
            break;
        }
    }
    var offset = i + 1;
    if (i == this.parseBuffer.length) return;
    result.push(this.parseBuffer.toString('ascii', this.offset, i - 1));
    this.offset = i + 1;
    return 1;
}

Parser.prototype.parse = function (collection) {
    if (this.parseBuffer.length <= this.offset) return 0;
    var finished;
    if (this.parseBuffer[this.offset] == 36) { //$
        this.offset++;
        finished = this.parseString(collection);
        return finished;
    } else if (this.parseBuffer[this.offset] == 42) { //*
        this.offset++;
        finished = this.parseList(collection);
        return finished;
    } else if (this.parseBuffer[this.offset] == 45) { //-
        this.offset++;
        finished = this.parseMessage(collection);
        return finished;
    } else if (this.parseBuffer[this.offset] == 43) { //+
        this.offset++;
        finished = this.parseMessage(collection);
        return finished;
    } else if (this.parseBuffer[this.offset] == 58) { //:
        this.offset++;
        finished = this.parseInt(collection);
        return finished;
    } else {
            //TODO: error handling
        var i = 0;
        i = 1;
    }
}

Parser.prototype.close = function () {
    this.closed = true;
}
