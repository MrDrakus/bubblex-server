const Player = require('../Player');

// BotPlayer odpowiada tylko za obsluge bota w MultiOgarII.
// Decyzje o ruchu, ucieczce, zbieraniu jedzenia i podziale
// podejmuje src/ai/BubbleXBotAI.js, wywolywany przez Server.js.
class BotPlayer extends Player {
    constructor(server, socket) {
        super(server, socket);
        this.isBot = true;
    }

    checkConnection() {
        // Zachowujemy automatyczne odradzanie bota po zjedzeniu.
        if (!this.cells.length)
            this.server.mode.onPlayerSpawn(this.server, this);
    }

    sendUpdate() {
        // UMYSLNIE PUSTE.
        // Server.updateClients() najpierw wykonuje updateTick(),
        // potem bubbleXBotAI.update(bot), a na koncu sendUpdate().
        // Stara logika w tym miejscu nadpisywala wybrany przez AI
        // kierunek ruchu, przez co boty staly albo scigaly bez konca.
        // FakeSocket nie wymaga wysylania widoku do przegladarki.
    }
}

module.exports = BotPlayer;
