const FakeSocket = require('./FakeSocket');
const Client = require('../Client');
const BotPlayer = require('./BotPlayer');
const MinionPlayer = require('./MinionPlayer');

// Pula wymyslonych nickow w stylu prawdziwych graczy.
// Kazdy bot otrzymuje losowy, niepowtarzajacy sie nick.
const BOT_NAMES = [
    'Franek34', 'MatiPL', 'Kacper17', 'NocnyLis', 'TurboKuba',
    'Dawid12', 'Piter', 'MalyKoks', 'Bananowy', 'Luki77',
    'Szogun', 'MisiekPL', 'Oskar09', 'Krecik', 'BialyWilk',
    'CichyGracz', 'Tofik', 'GrubyKot', 'Krystian22', 'KubaBoss',
    'WariatPL', 'Mlodzik', 'Borsuk', 'SzybkiJanek', 'Kapitan',
    'Zielony', 'GraczZiom', 'Foczka', 'Mroczny', 'Dyzio',
    'Rafal24', 'Pawel2004', 'Dzikus', 'Franio99', 'Koxu',
    'SowaPL', 'Malina', 'Adek', 'Tytan', 'Kruk',
    'Ziomus', 'JohnnyPL', 'Zbychu', 'KtosTam', 'Kaktus',
    'Strus', 'PanTost', 'MalyGigant', 'Olek11', 'Rico',
    'Nero', 'Rekin', 'NiskiPing', 'MrBanan', 'Adasiek',
    'TurboPanda', 'Ziemniak', 'Spryciarz', 'Leniwiec', 'MasterMati',
    'Kozak', 'ViperPL', 'Eryk', 'Borys', 'Cinek',
    'Noobek', 'Koral', 'Bratko', 'Kubson', 'ZielonyKot',
    'Niebieski', 'Pepe18', 'Szymon96', 'Kongo', 'Felek',
    'Chudy', 'Mrozu', 'Snejk', 'Waldi', 'Speedy',
    'Blady', 'MrPies', 'NocnyGracz', 'Kiwi', 'Zolw',
    'Zefir', 'Maniak', 'Benek', 'Wafel', 'Janek07',
    'BlackRaven', 'Cytrynka', 'CichyMati', 'Kacpi', 'Wiktor44',
    'Tofik13', 'Zaba', 'Lisek', 'TitanX', 'Ogryzek',
    'Ziomek24', 'Staszek', 'PanPierog', 'Natanek', 'Koziolek',
    'Noni', 'Damian200', 'Tobiasz', 'Reksio', 'LeonPL',
    'PanKaktus', 'MalyWojtek', 'Fenix', 'Rybak', 'Chomik',
    'Raptor', 'Mamut', 'Kuleczka', 'Miki12', 'Frycek',
    'PandaPL', 'Kornel', 'GrubyBanan', 'Gucio', 'Tuptus'
];

class BotLoader {
    constructor(server) {
        this.server = server;
        this.botCount = 0;
        this.availableNames = BOT_NAMES.slice();
        this.usedNames = new Set();
    }

    randomBotName() {
        let name;

        if (this.availableNames.length > 0) {
            // Losowanie bez powtorek: wybrany nick znika z puli.
            const index = Math.floor(Math.random() * this.availableNames.length);
            name = this.availableNames.splice(index, 1)[0];
        } else {
            // Rezerwa, gdyby w przyszlosci bylo wiecej botow niz nickow.
            do {
                name = `Gracz${Math.floor(Math.random() * 90000) + 10000}`;
            } while (this.usedNames.has(name));
        }

        this.usedNames.add(name);
        return name;
    }

    addBot() {
        const socket = new FakeSocket(this.server);
        socket.player = new BotPlayer(this.server, socket);
        socket.client = new Client(this.server, socket);

        const name = this.randomBotName();
        this.botCount++;

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
        socket.client.setNickname(name == '' || !name ? this.server.config.defaultName : name);
    }
}

module.exports = BotLoader;
