## Code walkthrough
Let’s go over the main file, `app.js`.

First we add all requirements 
```javascript 
var mqtt = require('mqtt'), URL = require('url');

var IOTA = require('iota.lib.js');

var async = require("async");

var nodeCleanup = require('node-cleanup');
```

Using [iota.lib.js](https://www.npmjs.com/package/iota.lib.js) to connect to **IOTA** tangle. [Open Source](https://github.com/iotaledger/iota.lib.js) 

Using [MQTT.js](https://www.npmjs.com/package/mqtt) as MQTT client. [Open Source](https://github.com/mqttjs/MQTT.js) 

Using [Async](https://www.npmjs.com/package/async) to handle queues. [Open Source](https://github.com/caolan/async) 

Using [node-cleanup](https://www.npmjs.com/package/node-cleanup) to properly close connections on exit. [Open Source](https://github.com/jtlapp/node-cleanup) 

Using [URL](https://www.npmjs.com/package/url) to parse full URL. [Open Source](https://github.com/defunctzombie/node-url) 

---

Then, before doing anything else, we setup the `node-cleanup` function to close any open MQTT connection.

```javascript
// Setup cleanup procedure
nodeCleanup(function (exitCode, signal) {
    // release resources here before node exits 
    console.log('Cleaning up...');
    if (client) {
        client.end();
        console.log('Closed MQTT client...');
    }
});
```

---
 
Next, we need a way to configure our MQTT to Tangle service. For this, we will be using environmental variables. These are great for passing config values to our process and are supported on just any PaaS (e.g. Heroku, Elastic Beanstalk, etc). 
We will be accessing each variable from the `process.env` or set it to a default value if not present.
```javascript
//
// ENVIRONMENT VARS
//
// MQTT vars
var MQTT_FULL_URL = process.env.MQTT_FULL_URL || 'mqtt://localhost:1883';
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
```
Check Environmental Variables for a description of each var. [LINKLINKLINKLINK](asdfadsfasd)

We will also need a var to count our tasks.
```javascript
// Global Vars
var taskCount = 0;  // for counting tasks.
//
```

---

Great, now we can start setting up our **IOTA** library instance, using the `IOTA_HOST` and `IOTA_PORT` variables we defined above.
```javascript
// Initialize IOTA instance
var iotajs = new IOTA({
    'host': IOTA_HOST,
    'port': IOTA_PORT
});  
```

---

Before initializing our MQTT client, let’s get our connection options ready.
We parse the `MQTT_FULL_URL` variable using `URL` to get the it’s components, and use them to fill in the `options` object.
> Notice how we add a random suffix to the `clientId` `MQTT_CLIENT_PREFIX` so you can have multiple services running and still be able to differentiate them.

```javascript
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
```

We can now init our MQTT client.
```javascript
// Connect to MQTT broker
var client = mqtt.connect(url, options);
```

---

Before setting the MQTT client events, we will define our handler for new messages. It will be called for every message the client receives on the `MQTT_TOPIC` topic.
First we bump the `taskCount` and create a new Task object.

> Tasks are the way this service enqueues messages to be sent to the Tangle. They have an `id` which is the current `taskCount` and a `message` which is the MQTT message payload. 

Once we have the Task object we push it to the transactions queue `txQueue` , with a completion handler (which in this case just logs that the task finished), more on it later.
```javascript
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
```

And another helper function to check if the **IOTA** node is working properly. It will make a call to `getNodeInfo` with a simple callback passthrough. We ignore the actual content of the info, and just use the error/success result. 
```javascript
// Helper for testing IOTA connection
function testIotaConnection(callback) {
  iotajs.api.getNodeInfo(function(error, success) {
      callback(error, success);
  });
}
```
> You can check more complex status here, like checking if there are enough neighbors connected or if it is synced. I’ll leave that as homework ;)

---

We now can set the other event handlers. 
First the `on connect`, which is one of the two most important  (together with `on message`). It is called just after a successful connect or reconnect, and is the place where we subscribe to the `MQTT_TOPIC` topic.

Also, here we test connection to our **IOTA** node using the `testIotaConnection` we defined above.
If we don’t succeed, we exit with failure.
If the node is working properly, we attach our `mqttOnMessageEventHandler`  to the `on message` event.


```javascript
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
```

> NOTE: There is a line you can uncomment to test the flow by publishing a test message, which will trigger the `on message` event.

And the rest of the events, for logging purposes only.
```javascript
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
```

---

Now, finally, we got to the good part. This is where **IOTA** plays the lead role. We start by initializing our transaction queue, using [Async](https://www.npmjs.com/package/async).
We define what will be done with each Task, in our case we want the payload from the MQTT messages to be stored on the Tangle. 

> To store information on the Tangle, you need to send a transaction to a recipient address (in our case `IOTA_ADDRESS`) with the information you want “tryte-encoded” on the `message` field of the transaction. This means that you need to encode the MQTT message that comes as an ASCII string to Trytes. Luckily, the `iota.lib.js` already has two helpers `toTrytes` and `fromTrytes` that will make your like easier.
> If you want to know more about Binary vs Trinary concept,  [check the official documentation](asdfadsfasd).

> Another important note, you will see here that the value of the transaction is `0`, we are not moving any **IOTA** tokens with this transfer, since we just want to store information on the Tangle. We don’t want to spend tokens every time we store information or pay fees for every transfer, and with **IOTA** there is no need to either, sounds cool right?

Ok, back to the code. For each task, we make a transfer object. The main fields are:
* `address` which is `IOTA_ADDRESS`,
* `value` which is `0` tokens
* `message` which is our tryte-encoded MQTT payload message
* `tag` which is our tryte-encoded `IOTA_TAG`.

Then we need  our `IOTA_SEED`, some common configuration values the `iotajs.api.sendTransfer` function needs to be able to make the transfer and a completion handler with error/success.

Actually, we make an Array of transfers, with one single transfer in it, since `iotajs.api.sendTransfer` takes an Array of transfers,  knowing this will help understand what we do on the completion handler:
We check if there was an error, and if there was we log it. If we succeeded, we can access the first element of the `success` array (our transfer), and get it’s `hash` . Then we log it.
After processing the transfer, we call `done()` which is the handler in charge of letting the queue know the Task has finished, so it can continue with the next one.

> Here we are only logging the hash of the transfers, you might want to do something else. I will leave that as homework.
> 
> Also, here the queue is synchronously sending one transfer, waiting for it to finish and then starting the new task. It may be a good idea to asynchronously send the transfers without waiting for them to finish. Again, I’ll leave this as homework ;) TIP: [read about concurrency parameter](https://github.com/caolan/async/blob/v1.5.2/README.md#queue)  and keep an eye on handling failures.

```javascript
// Setup transaction queue for pushing new message tasks.
var txQueue = async.queue(function(task, done) {
    console.log('Processing task ' + task.id + '.');

    var transfers = [{
        'address': IOTA_ADDRESS,
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
```

And another function that will be called when the queue finishes it’s last Task, this can happen multiple times though. Again for logging purposes only.
```javascript
txQueue.drain = function() {
    console.log('All tasks have been processed... waiting for more.');
};
```

---

### Conclusion
In this PoC we've looked at a way to store MQTT messages from any existing application on the Tangle, which showcases **IOTA**’s data transfer capabilities. Once MAM (Masked Authenticated Messaging) is released, we will make a follow-up tutorial which showcases secure, encrypted data transfer with granular access management.
Stay tuned!