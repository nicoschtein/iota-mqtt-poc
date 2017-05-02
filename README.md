# iota-mqtt-poc
[IOTA](https://www.iotatoken.com/) Proof of Concept, service that stores MQTT messages on the tangle.
## Requirements
Make sure you have [Node.js](http://nodejs.org/) and the [Heroku Toolbelt](https://toolbelt.heroku.com/) installed.

## Cloning & Running locally
```sh
git clone git@github.com:nicoschtein/iota-mqtt-poc.git # or clone your own fork
cd iota-mqtt-poc
heroku local
```

## Environmental Variables
### MQTT
* MQTT_FULL_URL 
	* MQTT Broker connection url with optional user/password parameters.
	* Example: `'mqtt://[user:pass@]localhost:1883'`
* MQTT_CLIENT_PREFIX 
	* Prefix to use on the MQTT client ID, followed by an 8-char string (pseudo)randomly generated using `Math.random()` .
	* Example: `'iota_poc_'` resulting in `iota_poc_3bc3eb87`
 * MQTT_TOPIC
	 * MQTT Topic to subscribe to, with support for `#` and `+`.
	 * Example:  `'/devices/+'`
### IOTA
* IOTA_HOST
	* Host of the IOTA Node to be used. IP and host names supported.
	* Example: `'http://127.0.0.1'` or `'http://localhost'`
* IOTA_PORT
	* Port of the IOTA Node to be used.
	* Example: `14265`
* IOTA_ADDRESS
	* IOTA Address to send the transactions to.
	* Example: `’999999999999999999999999999999999999999999999999999999999999999999999999999999999’`
* IOTA_SEED
	* IOTA Seed for sending the transactions from.
	* Example: `'999999999999999999999999999999999999999999999999999999999999999999999999999999999'`
* IOTA_TAG
	* IOTA Seed for bundling transactions. Maximum of 13 ascii chars.
	* Example: `’iota-mqtt-poc’`

## Setting Environmental Vars
### Locally using `.env` file.
Create a new file named `.env` and place it on the root directory, next to `package.json`.
```
MQTT_FULL_URL = 'mqtt://[user:pass@]localhost:1883'
MQTT_CLIENT_PREFIX = 'iota_poc_'
MQTT_TOPIC = '/devices/+'
IOTA_HOST = 'http://127.0.0.1'
IOTA_PORT = 14265
IOTA_ADDRESS = ’999999999999999999999999999999999999999999999999999999999999999999999999999999999’
IOTA_SEED = '999999999999999999999999999999999999999999999999999999999999999999999999999999999'
IOTA_TAG = 'iota-mqtt-poc'
```

### Remotely using Heroku Toolbet 
*Requires an existing Heroku App, see “Deploying to Heroku” for more info*

For each var use command `config:set` to set the values, if the value is already set it will be replaced.
```sh
...
heroku config:set IOTA_HOST='http://127.0.0.1'
heroku config:set IOTA_PORT=14265
...
```
To view current state of your vars:
```sh
heroku config
```

## Deploying to Heroku (Optional)
```sh
heroku create
git push heroku master
```
Open remote App
```sh
heroku open
```