const fs = require("fs");

const FakeSocket = require('./FakeSocket');
const Client = require('../Client');
const BotPlayer = require('./BotPlayer');
const MinionPlayer = require('./MinionPlayer');

const botnameFile = "./ai/botnames.txt";
let botnames = null;
if(fs.existsSync(botnameFile))
    botnames = fs.readFileSync(botnameFile, "utf-8").split("\n");

class BotLoader {
    constructor(server) {
        this.server = server;
        this.botCount = 0;
    }
    addBot() {
        const socket = new FakeSocket(this.server);
        socket.player = new BotPlayer(this.server, socket);
        socket.client = new Client(this.server, socket);

        const name = botnames ?
            botnames[Math.random() * botnames.length | 0] :
            `Bot | ${this.botCount++}`;

        this.server.clients.push(socket);
        socket.client.setNickname(name);
    }
    addMinion(owner, name, mass) {
        const maxSize = this.server.config.minionMaxStartSize;
        const defaultSize = this.server.config.minionStartSize;

        const socket = new FakeSocket(this.server);
        socket.player = new MinionPlayer(this.server, socket, owner);
        socket.client = new Client(this.server, socket);

        socket.player.spawnmass = mass || maxSize > defaultSize ? Math.floor(Math.random() * (maxSize - defaultSize) + defaultSize) : defaultSize;

        this.server.clients.push(socket);
        socket.client.setNickname(name == "" || !name ? this.server.config.defaultName : name);
    }
}

module.exports = BotLoader;
