
function Cluster(clusterResult) {
    var nodesString = clusterResult.split('\n');
    var char = clusterResult.charCodeAt(clusterResult.length - 1);
    this.nodes = [];
    for (var index = 0; index < nodesString.length; index++) {
        if(nodesString[index].length == 0) continue;
        var nodeFields = nodesString[index].split(' ');
        var node = {};
        node.id = nodeFields[0];
        node.name = nodeFields[1];
        var hostport = node.name.split(':');
        node.host = hostport[0];
        node.port = +hostport[1];
        parseFlags(nodeFields[2], node);
        node.slaveOf = nodeFields[3];
        node.configEpoch = +nodeFields[6];
        node.slots = [];
        for (var slotIndex = 8; slotIndex < nodeFields.length; slotIndex++) {
            var range = nodeFields[slotIndex];
            node.slots.push(range);
        }
        this.nodes.push(node);
        this.nodes[node.id] = node;
    }
}

module.exports.Cluster = Cluster;

function parseFlags(flags, node) {
    var tmp = flags.split(',');
    for (var index = 0; index < tmp.length; index++) {
        var flag = tmp[index];
        if (flag == 'master') {
            node.isMaster = true;
        } else if (flag == 'fail' || flag == 'fail?') {
            node.failed = true;
        } else if (flag == 'noaddr') {
            node.hasNoAddr = true;
        }
    }
}
