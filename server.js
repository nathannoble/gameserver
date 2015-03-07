var gm = new GameManager();


var WebSocketServer = require('ws').Server,
	wss = new WebSocketServer({
		port: 8080
	});

wss.on('connection', function(ws) {

	// Assign a uuid
	var playerId = getUuid();

	var response = {};

	// Join an open game
	var gameId = gm.joinGame(playerId, ws);
	ws.playerId = playerId;
	ws.gameId = gameId;

	ws.on('message', function(msg) {
		console.log('game: %j', msg);

		gm.processMessage(msg);
	});

	ws.on('close', function(code, msg) {
		console.log('closed: %j', this.gameId);

		var msg = {};
		msg.type = 'game';
		msg.value = 'stop';
		msg.gameId = this.gameId;
		msg.playerId = this.playerId;

		gm.stopGame(msg);
	});

});


function GameManager() {
	this.openGames = [];
	this.activeGames = [];
}

GameManager.prototype.joinGame = function(playerId, ws) {
	var og = null;
	var msg = {};

	if (this.openGames.length > 0) {
		og = this.openGames[0];
	} else {
		var gameId = getUuid();
		og = {
			gameId: gameId,
			players: []
		};
		this.openGames.push(og);

		msg.type = 'status';
		msg.value = 'waiting';

		sendObject(ws, msg);
	}

	og.players.push({
		playerId: playerId,
		ws: ws
	});

	if (og.players.length == 2) {
		// Start game
		this.activeGames.push(og);
		this.openGames.splice(0, 1);

		msg.type = 'game';
		msg.value = 'start';
		msg.gameId = og.gameId;
		msg.players = [];
		msg.players.push(og.players[0].playerId)
		msg.players.push(og.players[1].playerId)

		sendObject(og.players[0].ws, msg);
		sendObject(og.players[1].ws, msg);
	}

	return og.gameId;
}

GameManager.prototype.processMessage = function(msg) {

	var obj = JSON.parse(msg);

	// msg contains the game id
	for (var i = 0; i < this.activeGames.length; i++) {
		var og = this.activeGames[i];

		if (og.gameId == obj.gameId) {

			for (var j = 0; j < og.players.length; j++) {
				var pl = og.players[j];
				if (pl.playerId !== obj.playerId) {
					sendObject(pl.ws, obj);
					return;
				}
			}

		}

	}
}

GameManager.prototype.stopGame = function(msg) {

	for (var i = 0; i < this.activeGames.length; i++) {
		var og = this.activeGames[i];

		if (og.gameId == msg.gameId) {
			for (var j = 0; j < og.players.length; j++) {
				var pl = og.players[j];
				if (pl.playerId != msg.playerId) {
					sendObject(pl.ws, msg);
				}
			}

			this.activeGames.splice(i, 1);
		}
	}

	// Repeat for open games
	for (var i = 0; i < this.openGames.length; i++) {
		var og = this.openGames[i];

		if (og.gameId == msg.gameId) {
			for (var j = 0; j < og.players.length; j++) {
				var pl = og.players[j];
				if (pl.playerId != msg.playerId) {
					sendObject(pl.ws, msg);
				}
			}

			this.openGames.splice(i, 1);
		}
	}
}

function sendObject(ws, msg) {
	var obj = JSON.stringify(msg);

	if (ws._closeReceived) return;

	ws.send(obj);
}

function send(ws, msg) {

	if (ws._closeReceived) return;

	ws.send(msg);
}

function getUuid() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random() * 16 | 0,
			v = c == 'x' ? r : r & 0x3 | 0x8;
		return v.toString(16);
	});
}
