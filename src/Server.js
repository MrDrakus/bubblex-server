// Library imports
const http = require('http');
const https = require("https");
const fs = require("fs");
let os;
const WebSocket = require("ws");

// Project imports
const Entity = require('./entity');
const Vec2 = require('./modules/Vec2.js');
const Logger = require('./modules/Logger.js');
const {QuadNode, Quad} = require('./modules/QuadNode.js');
const Player = require('./Player');
const Client = require('./Client');
const PlayerCommand = require('./modules/PlayerCommand');
const BotLoader = require('./ai/BotLoader');
const Gamemode = require('./gamemodes');
const Packet = require('./packet');
const UserRoleEnum = require('./enum/UserRoleEnum');

// Server implementation
class Server {
    constructor() {
        // Location of source files - For renaming or moving source files!
        this.srcFiles = "../src";

        // Startup
        this.run = true;
        this.version = '1.6.3';
        this.httpServer = null;
        this.lastNodeId = 1;
        this.lastPlayerId = 1;
        this.clients = [];
        this.socketCount = 0;
        this.largestClient = null; // Required for spectators
        this.nodes = []; // Total nodes
        this.nodesVirus = []; // Virus nodes
        this.nodesFood = []; // Food nodes
        this.nodesEjected = []; // Ejected nodes
        this.nodesPlayer = []; // Player nodes
        this.movingNodes = []; // For move engine
        this.leaderboard = []; // For leaderboard
        this.leaderboardType = -1; // No type
        this.bots = new BotLoader(this);

        // Main loop tick
        this.startTime = Date.now();
        this.stepDateTime = 0;
        this.timeStamp = 0;
        this.updateTime = 0;
        this.updateTimeAvg = 0;
        this.timerLoopBind = null;
        this.mainLoopBind = null;
        this.ticks = 0;
        this.disableSpawn = false;

        // Config
        this.config = require("./config.js");
        this.ipBanList = [];
        this.minionTest = [];
        this.userList = [];
        this.badWords = [];
        this.loadFiles();

        // Obsługa portu środowiskowego Rendera
        if (process.env.PORT) {
            this.config.serverPort = parseInt(process.env.PORT);
        }

        // Set border, quad-tree
        this.setBorder(this.config.borderWidth, this.config.borderHeight);
        this.quadTree = new QuadNode(this.border);
    }
    start() {
        this.timerLoopBind = this.timerLoop.bind(this);
        this.mainLoopBind = this.mainLoop.bind(this);
        // Set up gamemode(s)
        this.mode = Gamemode.get(this.config.serverGamemode);
        this.mode.onServerInit(this);
        // Client Binding
        var bind = this.config.clientBind + "";
        this.clientBind = bind.split(' - ');

        // Check if certificates exist
        if (fs.existsSync('../keys/key.pem') && fs.existsSync('../keys/cert.pem')) {
            Logger.info("Using HTTPS, use the wss:// protocol prefix when connecting");
            this.httpServer = https.createServer({key: fs.readFileSync('../keys/key.pem', 'utf8'), cert: fs.readFileSync('../keys/cert.pem', 'utf8')});
        } else {
            // HTTP only
            Logger.info("Using HTTP");
            this.httpServer = http.createServer();
        }

        var wsOptions = {
            server: this.httpServer,
            perMessageDeflate: false,
            maxPayload: 4096
        };
        this.wsServer = new WebSocket.Server(wsOptions);
        this.wsServer.on('error', this.onServerSocketError.bind(this));
        this.wsServer.on('connection', this.onClientSocketOpen.bind(this));
        this.httpServer.listen(this.config.serverPort, this.config.serverBind, this.onHttpServerOpen.bind(this));
        // Start stats port (if needed)
        if (this.config.serverStatsPort > 0) {
            this.startStatsServer(this.config.serverStatsPort);
        }
        this.spawnCells(this.config.virusAmount, this.config.foodAmount);
    }
    onHttpServerOpen() {
        // Start Main Loop
        setTimeout(this.timerLoopBind, 1);
        // Done
        Logger.info("Game server started, on port " + this.config.serverPort);
        Logger.info("Current game mode is " + this.mode.name);
        // Player bots
        if (this.config.serverBots) {
            for (var i = 0; i < this.config.serverBots; i++)
                this.bots.addBot();
            Logger.info("Added " + this.config.serverBots + " player bots");
        }
    }
    addNode(node) {
        var x = node.position.x;
        var y = node.position.y;
        var s = node.radius;
        node.quadItem = {
            cell: node,
            bound: new Quad(x - s, y - s, x + s, y + s)
        };
        this.quadTree.insert(node.quadItem);
        this.nodes.push(node);
        node.onAdd(this);
    }
    onServerSocketError(error) {
        Logger.error("WebSocket: " + error.code + " - " + error.message);
        switch (error.code) {
            case "EADDRINUSE":
                Logger.error("Server could not bind to port " + this.config.serverPort + "!");
                break;
            case "EACCES":
                Logger.error("Please make sure you are running MultiOgarII with root privileges.");
                break;
        }
        process.exit(1);
    }
    onClientSocketOpen(ws, req) {
        var req = req || ws.upgradeReq;
        var logip = ws._socket.remoteAddress + ":" + ws._socket.remotePort;
        ws.on('error', function (err) {
            Logger.writeError("[" + logip + "] " + err.stack);
        });
        if (this.config.serverMaxConnections && this.socketCount >= this.config.serverMaxConnections) {
            ws.close(1000, "No slots");
            return;
        }
        if (this.checkIpBan(ws._socket.remoteAddress)) {
            ws.close(1000, "IP banned");
            return;
        }
        if (this.config.serverIpLimit) {
            var ipConnections = 0;
            for (var i = 0; i < this.clients.length; i++) {
                var socket = this.clients[i];
                if (!socket.isConnected || socket.remoteAddress != ws._socket.remoteAddress)
                    continue;
                ipConnections++;
            }
            if (ipConnections >= this.config.serverIpLimit) {
                ws.close(1000, "IP limit reached");
                return;
            }
        }
        if (this.config.clientBind.length && req.headers.origin && req.headers.origin.indexOf(this.clientBind) < 0) {
            ws.close(1000, "Client not allowed");
            return;
        }
        ws.isConnected = true;
        ws.remoteAddress = ws._socket.remoteAddress;
        ws.remotePort = ws._socket.remotePort;
        ws.lastAliveTime = Date.now();
        Logger.write("CONNECTED " + ws.remoteAddress + ":" + ws.remotePort);
        ws.player = new Player(this, ws);
        ws.client = new Client(this, ws);
        ws.playerCommand = new PlayerCommand(this, ws.player);
        ws.on('message', message => {
            if (this.config.serverWsModule === "uws")
                message = Buffer.from(message);
            if (!message.length) return;
            if (message.length > 256) {
                ws.close(1009, "Spam");
                return;
            }
            ws.client.handleMessage(message);
        });
        ws.on('error', function (error) {
            ws.client.sendPacket = function (data) { };
        });
        ws.on('close', reason => {
            if (ws._socket && ws._socket.destroy != null && typeof ws._socket.destroy == 'function') {
                ws._socket.destroy();
            }
            this.socketCount--;
            ws.isConnected = false;
            ws.client.sendPacket = () => {};
            ws.closeReason = {
                reason: ws._closeCode,
                message: ws._closeMessage
            };
            ws.closeTime = Date.now();
            Logger.write("DISCONNECTED " + ws.remoteAddress + ":" + ws.remotePort);
        });
        this.socketCount++;
        this.clients.push(ws);
        this.checkMinion(ws, req);
    }

    // Blokada restartu zapobiegająca pętli i odrzucaniu graczy
    restart() {
        Logger.warn("Auto-restart zablokowany: serwer Hardcore dziala stale.");
        return;
    }

    checkMinion(ws, req) {
        if (!req || !req.headers) return;
        if (!req.headers['user-agent'] || !req.headers['cache-control'] ||
            req.headers['user-agent'].length < 50) {
            ws.player.isMinion = true;
        }
        if (this.config.serverMinionThreshold) {
            if ((ws.lastAliveTime - this.startTime) / 1000 >= this.config.serverMinionIgnoreTime) {
                if (this.minionTest.length >= this.config.serverMinionThreshold) {
                    ws.player.isMinion = true;
                    for (var i = 0; i < this.minionTest.length; i++) {
                        var player = this.minionTest[i];
                        if (!player.socket.isConnected)
                            continue;
                        player.isMinion = true;
                    }
                    if (this.minionTest.length)
                        this.minionTest.splice(0, 1);
                }
                this.minionTest.push(ws.player);
            }
        }
        if (this.config.serverMinions && !ws.player.isMinion) {
            for (var i = 0; i < this.config.serverMinions; i++) {
                this.bots.addMinion(ws.player);
            }
        }
    }
    checkIpBan(ipAddress) {
        if (!this.ipBanList || !this.ipBanList.length || ipAddress == "127.0.0.1") {
            return false;
        }
        if (this.ipBanList.indexOf(ipAddress) >= 0) {
            return true;
        }
        var ipBin = ipAddress.split('.');
        if (ipBin.length != 4) {
            return false;
        }
        var subNet2 = ipBin[0] + "." + ipBin[1] + ".*.*";
        if (this.ipBanList.indexOf(subNet2) >= 0) {
            return true;
        }
        var subNet1 = ipBin[0] + "." + ipBin[1] + "." + ipBin[2] + ".*";
        if (this.ipBanList.indexOf(subNet1) >= 0) {
            return true;
        }
        return false;
    }
    setBorder(width, height) {
        var hw = width / 2;
        var hh = height / 2;
        this.border = new Quad(-hw, -hh, hw, hh);
        this.border.width = width;
        this.border.height = height;
    }
    getRandomColor() {
        var colorRGB = [0xFF, 0x07, (Math.random() * 256) >> 0];
        colorRGB.sort(function () {
            return 0.5 - Math.random();
        });
        return {
            r: colorRGB[0],
            g: colorRGB[1],
            b: colorRGB[2]
        };
    }
    removeNode(node) {
        node.isRemoved = true;
        this.quadTree.remove(node.quadItem);
        node.quadItem = null;
        this.nodes.removeUnsorted(node);
        this.movingNodes.removeUnsorted(node);
        node.onRemove(this);
    }
    updateClients() {
        for (var i = 0; i < this.clients.length; ++i) {
            const client = this.clients[i];
            client.player.checkConnection();
            if (client.player.isRemoved || client.isCloseRequest) {
                this.clients.removeUnsorted(null, i);
                --i;
            }
        }
        for (const client of this.clients) client.player.updateTick();
        for (const client of this.clients) client.player.sendUpdate();
        for (let i = 0; i < this.minionTest.length; ++i) {
            const minionTest = this.minionTest[i];
            if (!minionTest) continue;
            var date = new Date() - minionTest.connectedTime;
            if (date > this.config.serverMinionInterval) {
                this.minionTest.removeUnsorted(null, i);
                --i;
            }
        }
    }
    updateLeaderboard() {
        this.leaderboard = [];
        this.leaderboardType = -1;
        this.mode.updateLB(this, this.leaderboard);
        if (!this.mode.specByLeaderboard) {
            var clients = this.clients.valueOf();
            clients.sort(function (a, b) {
                return b.player._score - a.player._score;
            });
            this.largestClient = null;
            if (clients[0])
                this.largestClient = clients[0].player;
        }
        else {
            this.largestClient = this.mode.rankOne;
        }
    }
    onChatMessage(from, to, message) {
        if (!message || !(message = message.trim()))
            return;
        if (!this.config.serverChat || (from && from.isMuted)) {
            return;
        }
        if (from && message.length && message[0] == '/') {
            from.socket.playerCommand.processMessage(from, message);
            return;
        }
        if (message.length > 64) {
            message = message.slice(0, 64);
        }
        if (this.config.serverChatAscii) {
            for (var i = 0; i < message.length; i++) {
                if ((message.charCodeAt(i) < 0x20 || message.charCodeAt(i) > 0x7F) && from) {
                    this.sendChatMessage(null, from, "Message failed - You can use ASCII text only!");
                    return;
                }
            }
        }
        if (this.checkBadWord(message) && from && this.config.badWordFilter === 1) {
            this.sendChatMessage(null, from, "Message failed - Stop insulting others! Keep calm and be friendly please.");
            return;
        }
        this.sendChatMessage(from, to, message);
    }
    checkBadWord(value) {
        if (!(value = value.trim())) return false;
        value = ` ${value.toLowerCase()} `;
        for (const badWord of this.badWords)
            if (value.indexOf(badWord) >= 0) return true;
        return false;
    }
    sendChatMessage(from, to, message) {
        for (var i = 0, len = this.clients.length; i < len; i++) {
            if (!this.clients[i])
                continue;
            if (!to || to == this.clients[i].player) {
                if (this.config.separateChatForTeams && this.mode.haveTeams) {
                    if (from == null || from.team === this.clients[i].player.team) {
                        this.clients[i].client.sendPacket(new Packet.ChatMessage(from, message));
                    }
                }
                else {
                    this.clients[i].client.sendPacket(new Packet.ChatMessage(from, message));
                }
            }
        }
    }
    timerLoop() {
        var timeStep = 20;
        var ts = Date.now();
        var dt = ts - this.timeStamp;
        if (dt < timeStep - 5) {
            setTimeout(this.timerLoopBind, timeStep - 5);
            return;
        }
        if (dt > 120)
            this.timeStamp = ts - timeStep;
        this.updateTimeAvg += 0.5 * (this.updateTime - this.updateTimeAvg);
        this.timeStamp += timeStep;
        setTimeout(this.mainLoopBind, 0);
        setTimeout(this.timerLoopBind, 0);
    }
    mainLoop() {
        this.stepDateTime = Date.now();
        var tStart = process.hrtime();
        
        // Loop main functions
        if (this.run) {
            for (const cell of this.movingNodes) {
                if (cell.isRemoved || !cell.isMoving) continue;
                this.boostCell(cell);
                const nodes = this.quadTree.allOverlapped(cell.quadItem.bound);
                for (const check of nodes) {
                    var m = this.checkCellCollision(cell, check);
                    if (cell.type == 3 && check.type == 3 && !this.config.mobilePhysics)
                        this.resolveRigidCollision(m);
                    else this.resolveCollision(m);
                }
            }
            var eatCollisions = [];
            if (((this.ticks + 3) % 25) === 0)
                for (const cell of this.nodesPlayer) this.updateSizeDecay(cell);
            for (const cell of this.nodesPlayer) {
                if (cell.isRemoved) continue;
                const nodes = this.quadTree.allOverlapped(cell.quadItem.bound);
                for (const check of nodes) {
                    const m = this.checkCellCollision(cell, check);
                    if (this.checkRigidCollision(m))
                        this.resolveRigidCollision(m);
                    else if (check != cell) eatCollisions.push(m);
                }
                this.movePlayer(cell, cell.owner);
                this.boostCell(cell);
                this.autoSplit(cell, cell.owner);
                if (cell.owner.isMinion) {
                    cell.owner.socket.close(1000, "Minion");
                    this.removeNode(cell);
                }
            }
            for (const m of eatCollisions) this.resolveCollision(m);
            this.mode.onTick(this);
            this.ticks++;
        }
        this.updateClients();
        if (((this.ticks + 7) % 25) === 0)
            this.updateLeaderboard();
        if (this.config.serverTracker && (this.ticks % 750) === 0)
            this.pingServerTracker();
        var tEnd = process.hrtime(tStart);
        this.updateTime = tEnd[0] * 1e3 + tEnd[1] / 1e6;
    }
    movePlayer(cell, client) {
        if (client.socket.isConnected == false || client.frozen || !client.mouse)
            return;
        var d = client.mouse.difference(cell.position);
        var move = cell.getSpeed(d.dist());
        if (!move) return;
        cell.position.add(d.product(move));
        var time = this.config.playerRecombineTime, base = Math.max(time, cell.radius * 0.2) * 25;
        if (!time || client.rec || client.mergeOverride) {
            cell._canRemerge = cell.boostDistance < 100;
            return;
        }
        cell._canRemerge = cell.getAge() >= base;
    }
    updateSizeDecay(cell) {
        var rate = this.config.playerDecayRate, cap = this.config.playerDecayCap;
        if (!rate || cell.radius <= this.config.playerMinSize)
            return;
        if (cap && cell._mass > cap)
            rate *= 10;
        var decay = 1 - rate * this.mode.decayMod;
        cell.setSize(Math.sqrt(cell._radius2 * decay));
    }
    boostCell(cell) {
        if (cell.isMoving && !cell.boostDistance || cell.isRemoved) {
            cell.boostDistance = 0;
            cell.isMoving = false;
            return;
        }
        var speed = cell.boostDistance / 9;
        cell.boostDistance -= speed;
        cell.position.add(cell.boostDirection.product(speed));
        cell.checkBorder(this.border);
        this.updateNodeQuad(cell);
    }
    autoSplit(cell, client) {
        if (client.rec)
            var maxSize = 1e9;
        else
            maxSize = this.config.playerMaxSize;
        if (client.mergeOverride || cell.radius < maxSize)
            return;
        if (client.cells.length >= this.config.playerMaxCells || this.config.mobilePhysics) {
            cell.setSize(maxSize);
        }
        else {
            var angle = Math.random() * 2 * Math.PI;
            this.splitPlayerCell(client, cell, angle, cell._mass * .5);
        }
    }
    updateNodeQuad(node) {
        var item = node.quadItem.bound;
        item.minx = node.position.x - node.radius;
        item.miny = node.position.y - node.radius;
        item.maxx = node.position.x + node.radius;
        item.maxy = node.position.y + node.radius;
        this.quadTree.remove(node.quadItem);
        this.quadTree.insert(node.quadItem);
    }
    checkCellCollision(cell, check) {
        const p = check.position.difference(cell.position);
        return {
            cell: cell,
            check: check,
            d: p.dist(),
            p: p
        };
    }
    checkRigidCollision(m) {
        if (!m.cell.owner || !m.check.owner) return false;
        if (m.cell.owner != m.check.owner) {
            if (this.mode.haveTeams && m.check.owner.isMi || m.cell.owner.isMi && this.config.minionCollideTeam === 0) {
                return false;
            } else {
                return this.mode.haveTeams &&
                    m.cell.owner.team == m.check.owner.team;
            }
        }
        const age = this.config.mobilePhysics ? 1 : 13;
        if (m.cell.getAge() < age || m.check.getAge() < age) return false;
        return !m.cell._canRemerge || !m.check._canRemerge;
    }
    resolveRigidCollision(m) {
        if (m.d == 0) return;
        var push = (m.cell.radius + m.check.radius - m.d) / m.d;
        if (push <= 0) return;
        const massSum = m.cell._radius2 + m.check._radius2;
        const r1 = push * m.cell._radius2 / massSum;
        const r2 = push * m.check._radius2 / massSum;
        m.cell.position.subtract(m.p.product(r2));
        m.check.position.add(m.p.product(r1));
    }
    resolveCollision(m) {
        let cell = m.cell;
        let check = m.check;
        if (cell.isRemoved || check.isRemoved) return;
        if (cell.radius > check.radius) {
            cell = m.check;
            check = m.cell;
        }
        const div = this.config.mobilePhysics ? 20 : 3;
        if (m.d >= check.radius - cell.radius / div) return;
        if (cell.owner && cell.owner == check.owner) {
            if (cell.getAge() < 13 || check.getAge() < 13)
                return;
        }
        else if (check.radius < cell.radius * 1.15 || !check.canEat(cell))
            return;
        check.onEat(cell);
        cell.onEaten(check);
        cell.killer = check;
        this.removeNode(cell);
    }
    splitPlayerCell(client, parent, angle, mass) {
        var size = Math.sqrt(mass * 100);
        var size1 = Math.sqrt(parent._radius2 - size * size);
        if (!size1 || size1 < this.config.playerMinSize)
            return;
        parent.setSize(size1);
        var newCell = new Entity.PlayerCell(this, client, parent.position, size);
        newCell.setBoost(this.config.splitVelocity * Math.pow(size, 0.0122), angle);
        this.addNode(newCell);
    }
    randomPos() {
        return new Vec2(this.border.minx + this.border.width * Math.random(),
            this.border.miny + this.border.height * Math.random());
    }
    safeSpawn(cell) {
        const maxAttempts = 10;
        var spawnSuccess = false;
        var attempts = 0;
        while (!spawnSuccess && attempts < maxAttempts) {
            if (!this.willCollide(cell)) {
                spawnSuccess = true;
            }
            else {
                cell.position = this.randomPos();
                attempts++;
            }
        }
        this.addNode(cell);
    }
    spawnFood() {
        var cell = new Entity.Food(this, null, this.randomPos(), this.config.foodMinSize);
        if (this.config.foodMassGrow) {
            var maxGrow = this.config.foodMaxSize - cell.radius;
            cell.setSize(cell.radius += maxGrow * Math.random());
        }
        cell.color = this.getRandomColor();
        this.addNode(cell);
    }
    spawnVirus() {
        var virus = new Entity.Virus(this, null, this.randomPos(), this.config.virusMinSize);
        this.safeSpawn(virus);
    }
    spawnCells(virusCount, foodCount) {
        for (var i = 0; i < foodCount; i++) {
            this.spawnFood();
        }
        for (var ii = 0; ii < virusCount; ii++) {
            this.spawnVirus();
        }
    }
    spawnPlayer(player, pos) {
        if (this.disableSpawn)
            return;
        var size = this.config.playerStartSize;
        if (player.spawnmass)
            size = player.spawnmass;
        var index = ~~(this.nodesEjected.length * Math.random());
        var eject = this.nodesEjected[index];
        if (Math.random() <= this.config.ejectSpawnPercent &&
            eject && eject.boostDistance < 1) {
            pos = eject.position.clone();
            player.color = eject.color;
            size = Math.max(size, eject.radius * 1.15);
        }
        var cell = new Entity.PlayerCell(this, player, pos, size);
        player.isMi ? this.addNode(cell) : this.safeSpawn(cell);
        player.mouse.assign(pos);
    }
    willCollide(cell) {
        const x = cell.position.x;
        const y = cell.position.y;
        const r = cell.radius;
        const bound = new Quad(x - r, y - r, x + r, y + r);
        return this.quadTree.find(bound, n => n.type == 0);
    }
    splitCells(client) {
        var cellToSplit = [];
        for (var i = 0; i < client.cells.length; i++)
            cellToSplit.push(client.cells[i]);
        for (const cell of cellToSplit) {
            var d = client.mouse.difference(cell.position);
            if (d.distSquared() < 1) d.x = 1, d.y = 0;
            if (cell.radius < this.config.playerMinSplitSize) continue;
            const max = client.rec ? 200 : this.config.playerMaxCells;
            if (client.cells.length >= max) continue;
            this.splitPlayerCell(client, cell, d.angle(), cell._mass * .5);
        }
    }
    canEjectMass(client) {
        if (client.lastEject === null) {
            client.lastEject = this.ticks;
            return true;
        }
        if (this.ticks - client.lastEject < this.config.ejectCooldown)
            return false;
        client.lastEject = this.ticks;
        return true;
    }
    ejectMass(client) {
        if (!this.canEjectMass(client) || client.frozen) return;
        for (var i = 0; i < client.cells.length; i++) {
            var cell = client.cells[i];
            if (cell.radius < this.config.playerMinEjectSize) continue;
            var loss = this.config.ejectSizeLoss;
            var newSize = cell._radius2 - loss * loss;
            var minSize = this.config.playerMinSize;
            if (newSize < 0 || newSize < minSize * minSize)
                continue;
            cell.setSize(Math.sqrt(newSize));

            var d = client.mouse.difference(cell.position);
            var sq = d.dist();
            d.x = sq > 1 ? d.x / sq : 1;
            d.y = sq > 1 ? d.y / sq : 0;

            var pos = cell.position.sum(d.product(cell.radius));
            var angle = d.angle() + (Math.random() * .6) - .3;
            var ejected;
            if (this.config.ejectVirus) {
                ejected = new Entity.Virus(this, null, pos, this.config.ejectSize);
            } else {
                ejected = new Entity.EjectedMass(this, null, pos, this.config.ejectSize);
            }
            ejected.color = cell.color;
            ejected.setBoost(this.config.ejectVelocity, angle);
            this.addNode(ejected);
        }
    }
    shootVirus(parent, angle) {
        var pos = parent.position.clone();
        var newVirus = new Entity.Virus(this, null, pos, this.config.virusMinSize);
        newVirus.setBoost(this.config.virusVelocity, angle);
        this.addNode(newVirus);
    }
    loadFiles() {
        var fileNameBadWords = this.srcFiles + '/badwords.txt';
        try {
            if (!fs.existsSync(fileNameBadWords)) {
                Logger.warn(fileNameBadWords + " not found");
            }
            else {
                var words = fs.readFileSync(fileNameBadWords, 'utf-8');
                words = words.split(/[\r\n]+/);
                words = words.map(function (arg) {
                    return " " + arg.trim().toLowerCase() + " ";
                });
                words = words.filter(function (arg) {
                    return arg.length > 2;
                });
                this.badWords = words;
                Logger.info(this.badWords.length + " bad words loaded");
            }
        }
        catch (err) {
            Logger.error(err.stack);
            Logger.error("Failed to load " + fileNameBadWords + ": " + err.message);
        }
        var fileNameUsers = this.srcFiles + '/enum/userRoles.json';
        try {
            this.userList = [];
            if (!fs.existsSync(fileNameUsers)) {
                Logger.warn(fileNameUsers + " is missing.");
                return;
            }
            var usersJson = fs.readFileSync(fileNameUsers, 'utf-8');
            var list = JSON.parse(usersJson.trim());
            for (var i = 0; i < list.length;) {
                var item = list[i];
                if (!item.hasOwnProperty("ip") ||
                    !item.hasOwnProperty("password") ||
                    !item.hasOwnProperty("role") ||
                    !item.hasOwnProperty("name")) {
                    list.splice(i, 1);
                    continue;
                }
                if (!item.password || !item.password.trim()) {
                    Logger.warn("User account \"" + item.name + "\" disabled");
                    list.splice(i, 1);
                    continue;
                }
                if (item.ip) item.ip = item.ip.trim();
                item.password = item.password.trim();
                if (!UserRoleEnum.hasOwnProperty(item.role)) {
                    Logger.warn("Unknown user role: " + item.role);
                    item.role = UserRoleEnum.USER;
                }
                else item.role = UserRoleEnum[item.role];
                item.name = (item.name || "").trim();
                i++;
            }
            this.userList = list;
            Logger.info(this.userList.length + " user records loaded.");
        }
        catch (err) {
            Logger.error(err.stack);
            Logger.error("Failed to load " + fileNameUsers + ": " + err.message);
        }
        var fileNameIpBan = this.srcFiles + '/ipbanlist.txt';
        try {
            if (fs.existsSync(fileNameIpBan)) {
                this.ipBanList = fs.readFileSync(fileNameIpBan, "utf8")
                    .split(/[\r\n]+/)
                    .filter(x => x != '');
                Logger.info(this.ipBanList.length + " IP ban records loaded.");
            } else Logger.warn(fileNameIpBan + " is missing.");
        } catch (err) {
            Logger.error(err.stack);
            Logger.error("Failed to load " + fileNameIpBan + ": " + err.message);
        }
        this.config.serverRestart = this.config.serverRestart === 0 ? 1e999 : this.config.serverRestart * 1500;
    }
    startStatsServer(port) {
        this.getStats();
        this.httpServer = http.createServer(function (req, res) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.writeHead(200);
            res.end(this.stats);
        }.bind(this));
        this.httpServer.on('error', function (err) {
            Logger.error("Failed to start stats server: " + err.message);
        });
        var getStatsBind = this.getStats.bind(this);
        this.httpServer.listen(port, function () {
            Logger.info("Started stats server on port " + port);
            setInterval(getStatsBind, this.config.serverStatsUpdate * 1000);
        }.bind(this));
    }
    getStats() {
        let alivePlayers = 0;
        let spectatePlayers = 0;
        let bots = 0;
        let minions = 0;
        for (const client of this.clients) {
            if (!client || !client.isConnected) continue;
            if (client.player.isBot) ++bots;
            else if (client.player.isMi) ++minions;
            else if (client.player.cells.length) ++alivePlayers;
            else ++spectatePlayers;
        }
        var s = {
            'server_name': this.config.serverName,
            'server_chat': this.config.serverChat ? "true" : "false",
            'border_width': this.border.width,
            'border_height': this.border.height,
            'gamemode': this.mode.name,
            'max_players': this.config.serverMaxConnections,
            'current_players': alivePlayers + spectatePlayers,
            'alive': alivePlayers,
            'spectators': spectatePlayers,
            'bots': bots,
            'minions': minions,
            'update_time': this.updateTimeAvg.toFixed(3),
            'uptime': Math.round((this.stepDateTime - this.startTime) / 1000 / 60),
            'start_time': this.startTime,
            'stats_time': Date.now()
        };
        this.statsObj = s;
        this.stats = JSON.stringify(s);
    }
    pingServerTracker() {
        if (!os) os = require('os');
        var totalPlayers = 0;
        var alivePlayers = 0;
        var spectatePlayers = 0;
        var robotPlayers = 0;
        for (var i = 0, len = this.clients.length; i < len; i++) {
            var socket = this.clients[i];
            if (!socket || socket.isConnected == false)
                continue;
            if (socket.isConnected == null) {
                robotPlayers++;
            }
            else {
                totalPlayers++;
                if (socket.player.cells.length)
                    alivePlayers++;
                else
                    spectatePlayers++;
            }
        }
        var data = 'current_players=' + totalPlayers +
            '&alive=' + alivePlayers +
            '&spectators=' + spectatePlayers +
            '&max_players=' + this.config.serverMaxConnections +
            '&sport=' + this.config.serverPort +
            '&gamemode=[**] ' + this.mode.name +
            '&agario=true' +
            '&name=Unnamed Server' +
            '&opp=' + os.platform() + ' ' + os.arch() +
            '&uptime=' + process.uptime() +
            '&version=MultiOgarII ' + this.version +
            '&start_time=' + this.startTime;
        trackerRequest({
            host: 'ogar.mivabe.nl',
            port: 80,
            path: '/master',
            method: 'POST'
        }, 'application/x-www-form-urlencoded', data);
    }
}

function trackerRequest(options, type, body) {
    if (options.headers == null) options.headers = {};
    options.headers['user-agent'] = 'MultiOgarII' + this.version;
    options.headers['content-type'] = type;
    options.headers['content-length'] = body == null ? 0 : Buffer.byteLength(body, 'utf8');
    var req = http.request(options, function (res) {
        if (res.statusCode != 200) {
            Logger.writeError("[Tracker][" + options.host + "]: statusCode = " + res.statusCode);
            return;
        }
        res.setEncoding('utf8');
    });
    req.on('error', function (err) {
        Logger.writeError("[Tracker][" + options.host + "]: " + err);
    });
    req.shouldKeepAlive = false;
    req.on('close', function () {
        req.destroy();
    });
    req.write(body);
    req.end();
}
module.exports = Server;
