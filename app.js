var mqtt = require('mqtt'), URL = require('url');

var IOTA = require('iota.lib.js');

var async = require("async");

var nodeCleanup = require('node-cleanup');

// Setup cleanup procedure
nodeCleanup(function (exitCode, signal) {
    // release resources here before node exits 
    console.log('Cleaning up...');
    if (client) {
        client.end();
        console.log('Closed MQTT client...');
    }
});

//
// ENVIRONMENT VARS
//
// MQTT vars
var MQTT_FULL_URL = process.env.MQTT_FULL_URL || 'mqtts://localhost:1883';
var MQTT_CLIENT_PREFIX = process.env.MQTT_CLIENT_PREFIX || 'iota_poc_';
var MQTT_TOPIC = process.env.MQTT_TOPIC || '/devices/+';
// IOTA vars
var IOTA_HOST = process.env.IOTA_HOST || 'http://85.93.93.110';
var IOTA_PORT = process.env.IOTA_PORT || 14265;
var IOTA_ADDRESS = process.env.IOTA_ADDRESS || 'LRHDQ9EXZZFBZUCIDIQKXQFRPFPLMGYSAXEFAJJJJFHYMWGVDEQXVSFWNKBDYOZOLRSJWUG9SUDLLOVZGLYVJGFGZN';
var IOTA_SEED = process.env.IOTA_SEED || '999999999999999999999999999999999999999999999999999999999999999999999999999999999';
var IOTA_TAG = process.env.IOTA_TAG || 'iota-mqtt-poc';
//
// END ENVIRONMENT VARS
//

// Global Vars
var taskCount = 0;    // for counting tasks.
//

// Initialize IOTA instance
var iotajs = new IOTA({
    'host': IOTA_HOST,
    'port': IOTA_PORT
});

// Parse MQTT broker connection full URL
var mqtt_url = URL.parse(MQTT_FULL_URL);
var auth = (mqtt_url.auth || ':').split(':');
var url = mqtt_url.protocol + "//" + mqtt_url.host;

// Setup MQTT broker connection options
var options = {
  port: mqtt_url.port,
  clientId: MQTT_CLIENT_PREFIX + Math.random().toString(16).substr(2, 8),
  username: auth[0],
  password: auth[1],
  reconnectPeriod: 1000
};

// Connect to MQTT broker
var client = mqtt.connect(url, options);

// Handler for new MQTT messages
var mqttOnMessageEventHandler = function (topic, message) {
    taskCount++;
    // message is Buffer 
    var task  = {id:taskCount, message: message.toString()};
    console.log('Adding task ' + task.id + ' to queue with message "' + task.message + '".');

    // Push new message task to the transaction queue to be processed.
    txQueue.push(task, function(err) {
        console.log('Finished processing task ' + task.id + '.');
    });
}

// Helper for testing IOTA connection
function testIotaConnection(callback) {
    iotajs.api.getNodeInfo(function(error, success) {
        callback(error, success);
    });
}

// Setup MQTT client on connect event
client.on('connect', function () {
    console.log("MQTT Connected.");
    client.subscribe(MQTT_TOPIC);
    console.log('MQTT subscribed to "' + MQTT_TOPIC + '".');
 
    testIotaConnection(function(error, success) {
        if (error) {
            console.error("[FATAL] IOTA connection failed with error: " + error);
            process.exit(1); // Exit with failure.
        } else {
            console.log("IOTA test successful.")
            // Remove listener since this might be a reconnect.
            client.removeListener('message', mqttOnMessageEventHandler);
            // Setup MQTT client on new message event
            client.on('message', mqttOnMessageEventHandler);
            console.log("Starting service.");
             /// Uncomment for debugging:
             // client.publish('/devices/AB01', '{"temp":11.11}');
         }
     })
});
// Setup MQTT client on disconnect event
client.on('close', function () {
    console.log("MQTT disconnected... will try to reconnect.");
});
// Setup MQTT client on error event
client.on('error', function () {
    console.log("MQTT connection error.");
});
// Setup MQTT client on reconnect event
client.on('reconnect', function () {
    console.log("MQTT attempting reconnect...");
});


// Setup transaction queue for pushing new message tasks.
var txQueue = async.queue(function(task, done) {
    console.log('Processing task ' + task.id + '.');

    var transfers = [{
        'address': iotajs.utils.noChecksum(IOTA_ADDRESS),
        'value': 0,
        'message': iotajs.utils.toTrytes(task.message),
        'tag': iotajs.utils.toTrytes(IOTA_TAG)
    }];
    var seed = IOTA_SEED;
    var depth = 9;
    var minWeightMagnitude = 18;

    iotajs.api.sendTransfer(seed, depth, minWeightMagnitude, transfers, function(error,success) {
        if (!error) {
            // Only one transfer so we can get the new TX hash by accessing .hash on first element of success.
            console.log("Successfully made transfer for task " + task.id +', with transaction ID: "' + success[0].hash + '".');
        } else {
            console.log("Failed to make transfer for task " + task.id +', with error: ' + error);
        }
        done();
    });
}, 1);
txQueue.drain = function() {
    console.log('All tasks have been processed... waiting for more.');
};
