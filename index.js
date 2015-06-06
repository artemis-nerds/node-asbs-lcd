var LCD = require('lcd-pcf8574');
var asbs = require('asbs-lib');
var config = require('config');
var fs = require('fs');

var packageData = JSON.parse(fs.readFileSync('./package.json'));
 
var ArgumentParser = require('argparse').ArgumentParser;
var parser = new ArgumentParser({
  version: packageData.version,
  addHelp: true,
  description: packageData.description
});
parser.addArgument( [ '-H', '--host' ], { help: 'IP or hostname of the game server to connect to.' } );
parser.addArgument( [ '-p', '--port' ], { help: 'TCP port of the game server to connect to (defaults to 2010).' , defaultValue: 2010} );
parser.addArgument( [ '-s', '--ship' ], { help: 'Ship index, 1 to 8 (defaults to 1)', defaultValue: 1 } );
parser.addArgument( [ '-l', '--local' ], { help: 'Local IP address to connect from, use only when several (virtual) network interfaces are present.' } );

parser.addArgument( [ '-b', '--bus' ], { help: 'i2c bus number (defaults to 1). Run \'i2cdetect -l\' to see available buses.' , defaultValue: 1} );
parser.addArgument( [ '-d', '--device' ], { help: 'i2c device address (defaults to 0x27). Run \'i2cdetect -y (bus nomber)\' to see available devices.' , defaultValue: 0x27} );

var args = parser.parseArgs();
args.ship = parseInt(args.ship,10);


var lcd = new LCD('/dev/i2c-' + args.bus, args.device);

// lcd.createChar( 0,[ 0x1B,0x15,0x0E,0x1B,0x15,0x1B,0x15,0x0E] ).createChar( 1,[ 0x0C,0x12,0x12,0x0C,0x00,0x00,0x00,0x00] );

lcd.write( LCD.DISPLAYCONTROL | LCD.DISPLAYON | LCD.CURSOROFF | LCD.BLINKOFF, 0 );



function radiansToHeading(rads) {
	// Heading is -Math.PI for 0, 0 for 180, and +Math.PI for 360.
	return (rads / 2 / Math.PI * 360) + 180;
}

var ship = {};
var shipName = '';
var shipID = null;

var sock = new asbs.Socket();

function init() {
	shipID = null;
	ship = {};
	
	lcd.clear();
	lcd.setCursor(0,0).print('HDG --- IMP ---%');
	lcd.setCursor(0,1).print('ENE --- SHL --- ');
	
// 	lcd.setCursor(0,0).print('HDG 123 SPD 0.64');
// 	lcd.setCursor(0,1).print('ENE 999 WRP 1   ');
}

function reprintString(col,row,str) {
	lcd.setCursor(col,row).print(str);
}

// Always pad to three digits, assume positive numbers
function padNumber(number) {
	number = Math.round(number);
	if (number < 10) {
		return '  ' + number;
	}
	if (number < 100) {
		return ' ' + number;
	}
	return number.toString();
}

/// TODO: Somehow make the position of the indicators configurable.
function updateEnergy(energy) {
	if (energy > 999) {
		energy = 'TOP';
	} else {
		energy = padNumber(energy);
	}
// 	console.log('energy', energy);
	reprintString(4, 1, energy);
}

function updateHeading(hdg) {
// 	console.log('Heading radians', hdg);
	hdg = Math.round(radiansToHeading(hdg));
// 	console.log('Heading degrees', hdg);
	reprintString(4,0, padNumber(hdg));
}

var warpIsBeingDisplayed = false;
function updateSpeed(impulse, warp) {
// 	console.log('Speed', impulse * 100, warp);

	if (!warpIsBeingDisplayed && warp) {
		reprintString(8,0,"WRP");
		warpIsBeingDisplayed = true;
	}
	if (warpIsBeingDisplayed && !warp) {
		reprintString(8,0,"IMP");
		warpIsBeingDisplayed = false;
	}
	if (warpIsBeingDisplayed) {
		reprintString(12,0, padNumber(warp) + ' ');
	} else {
		reprintString(12,0, padNumber(Math.round(impulse * 100)) + '%');
	}
}

function updateShield(state) {
	var str = state ? ' UP' : 'DWN';
	reprintString(12,1, str);
}


sock.on('connect', function(){
	sock.send('setPlayerShipIndex', {playerShipIndex: args.ship -1 });
	sock.send('setConsole',{console: 'data' , selected: true});
	sock.send('setReady',{});
	init();
});

sock.on('allPlayerShipsSettings', function(data){
	shipName = data[ args.ship ].name;
});

sock.on('remove', function(data){
	if (data.type === 'player' && data.id === shipID) {
		// Own ship has been destroyed
		init();
	}
});

sock.on('difficulty', init);

sock.connect({ 
	host: args.host, 
	port: args.port,
	localAddress: args.local
});



sock.on('playerShip', function(update) {
	
	if (shipID !== null && update.id !== shipID) return;

	if ('playerShipIndex' in update.data) {
		if (update.data.playerShipIndex != args.ship) return;
		if (!shipID) {
			shipID = update.id;
		}
	}
	if (!shipID) {
		console.log("I don't know my ship ID yet.");
		return;
	}
	
	var mustUpdateSpeed = false;
	if (update.data.hasOwnProperty('impulseSpeed')) {
		ship.impulseSpeed = update.data.impulseSpeed;
		mustUpdateSpeed = true;
	}
	if (update.data.hasOwnProperty('warp')) {
		ship.warp = update.data.warp;
		mustUpdateSpeed = true;
	}
	if (mustUpdateSpeed) {
		updateSpeed(ship.impulseSpeed, ship.warp);
	}
	
	
	if (update.data.hasOwnProperty('heading')){
		updateHeading(update.data.heading);
	}
	
	
	if (update.data.hasOwnProperty('energy')){
		var energy = Math.round(update.data.energy);
		if (energy != ship.energy) {
			updateEnergy(update.data.energy);
			ship.energy = energy;
		}
	}
	
	
	if (update.data.hasOwnProperty('shieldState')){
		updateShield(update.data.shieldState);
	}
	
	
// 	var hdg = radiansToHeading(ship.heading);
// 	
// 	console.log('ID: %d, ENE: %d, WRP: %d, IMP: %d, RUD: %d, VEL: %d, HDG: %d, X: %d, Z: %d', 
// 		    Math.round(update.id), 
// 		    Math.round(ship.energy), 
// 		    Math.round(ship.warp), 
// 		    Math.round(ship.impulseSpeed * 100) / 100, 
// 		    Math.round(ship.rudder * 100) / 100, 
// 		    Math.round(ship.velocity * 100) / 100, 
// 		    Math.round(hdg)
// 	);
	
// 	console.dir(ship);
// 	if (Object.keys(update.data).length > 10) {
// 		console.dir(update.data);
// 	}
});


