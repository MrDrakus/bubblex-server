// BubbleX.pl - losowe, naturalne nicki botow.
// 300 bazowych nazw + ponad 100 koncowek. Bez powtorzen wsrod botow.
const FakeSocket = require('./FakeSocket');
const Client = require('../Client');
const BotPlayer = require('./BotPlayer');
const MinionPlayer = require('./MinionPlayer');

const BASE_NICKS = [
    "Franek", "Mati", "Kuba", "Kacper", "Oskar", "Dawid",
    "Patryk", "Bartek", "Szymon", "Michal", "Pawel", "Rafal",
    "Arek", "Tomek", "Wojtek", "Janek", "Filip", "Igor",
    "Eryk", "Natan", "Alan", "Maks", "Leon", "Adam",
    "Wiktor", "Marcel", "Maciek", "Karol", "Dominik", "Mateusz",
    "Jakub", "Lukasz", "Adrian", "Krystian", "Damian", "Daniel",
    "Hubert", "Grzesiek", "Robert", "Piotrek", "Radek", "Mirek",
    "Areczek", "Staszek", "Antos", "Franio", "Mikolaj", "Olaf",
    "Nikodem", "Tymek", "Tobiasz", "Olek", "Gracjan", "Marcin",
    "Radzio", "Cinek", "Norbi", "Benek", "Witek", "Kamil",
    "Kornelek", "Kornel", "Przemek", "MatiMati", "Kubson", "Kacpi",
    "Bartus", "Felek", "Gucio", "Zygi", "Kori", "Piter",
    "Zbychu", "JohnnyP", "Jasiu", "Kazik", "LeoN", "Szymek",
    "Blazej", "Slawek", "Julek", "Jurek", "Romek", "Leszek",
    "Kajtek", "Miki", "Fifi", "FelekPL", "HarryPL", "AlexPL",
    "MartinPL", "KrisPL", "Rysiek", "Franiu", "Boniek", "Cezar",
    "Grzesiu", "Olo", "Kubi", "Czarek", "Krysiek", "Tomeczek",
    "Dawidek", "Rafcio", "Pawcio", "Kamyk", "Wiciu", "Fido",
    "Adasiek", "Raptor", "Viper", "Fenix", "Reaper", "Shadow",
    "Snajper", "NeoPixel", "DarkWolf", "RedFox", "BlueWolf", "BlackCat",
    "SilverFox", "NightFox", "GhostRider", "SteelFox", "TurboMati", "QuickShot",
    "SpeedyX", "FastKuba", "PixelPro", "NinjaPL", "NinjaKox", "ZenonX",
    "MrFreeze", "FrostX", "ArcticFox", "IceKing", "BlazeX", "FireBolt",
    "DragonPL", "DragonX", "Drako", "ThunderPL", "FlashPL", "FlashX",
    "StormX", "Koxu", "Koxik", "Koxiarz", "Noobek", "NoobPro",
    "ProKuba", "ProMati", "SkillShot", "HeadshotPL", "AimKing", "XenoRex",
    "ZoroX", "RikoX", "RamboPL", "RamboX", "TigerX", "LethalFox",
    "GhostPL", "DarkRaptor", "SteelRaven", "BlackRaven", "ShadowFox", "SilentPL",
    "TurboLis", "TurboKot", "TurboPanda", "MegaLis", "MegaKot", "RaptorPL",
    "CichySnajper", "SlowMotion", "HighPing", "NiskiPing", "PixelMan", "PixelBoy",
    "PixelWolf", "NeoFox", "NeoRex", "MrPixel", "PlayerOne", "GameOver",
    "TryHardPL", "KoxikPL", "Spaceman", "ZoomerPL", "DriftKing", "Speedster",
    "MrNinja", "NocnyGracz", "ZimnyLis", "HektorPL", "HunterPL", "ScoutPL",
    "FalconPL", "WolfKing", "RysiuPro", "KobraPL", "TornadoX", "DynamitPL",
    "SztormPL", "TytanPL", "SprinterPL", "TurboGracz", "KrukPL", "KrukX",
    "GolemPL", "WizardPL", "CichyKox", "GigaMati", "PowerKuba", "MalyKoks",
    "MalyBoss", "MistrzPL", "MistrzKulek", "GigaGracz", "MegaKuba", "LokiPL",
    "ZeusPL", "NocnyLis", "GrubyKot", "PanTost", "PanPierog", "Bananek",
    "MrBanan", "Bananowy", "KiwiPL", "KiwiX", "Lisek", "Krecik",
    "MalyKret", "PanKret", "Chomik", "ChomikPL", "Ziemniak", "Ziemniaczek",
    "Pierozek", "Klusek", "Kluska", "Ogorek", "PanOgorek", "MalyZolw",
    "Zolwik", "Mamut", "PandaPL", "PandaX", "Foczka", "FokaPL",
    "Spryciarz", "Tuptus", "Tuptak", "Kaktus", "PanKaktus", "Leniwiec",
    "LeniwiecPL", "GrubyBanan", "GrubyKret", "GrubyLis", "GigaZiemniak", "NocnyKot",
    "NocnyKruk", "NocnyZolw", "BialyWilk", "BorsukPL", "BorsukX", "ZabaPL",
    "ZabkaPL", "ZefirPL", "Zefirek", "RybakPL", "RekinPL", "RybkaPL",
    "GraczZiom", "Ziomus", "ZiomPL", "Ziomek", "Tofik", "TofikPL",
    "MisiekPL", "MisioX", "PuchatekPL", "WafelPL", "Wafelek", "SowaPL",
    "SowaX", "Pingwinek", "PingwinPL", "JezykPL", "JezykX", "MalyDzik",
    "DzikusPL", "LisekPL", "KrolKulek", "WladcaKulek", "PiernikPL", "Pierniczek",
];

// 99 klasycznych koncowek liczbowych, kilka rocznikow i koncowki gamingowe (bez YT).
const NUMBER_SUFFIXES = [
    ...Array.from({ length: 99 }, (_, index) => String(index + 1)),
    '2004', '2005', '2006', '2007', '2008', '2009', '2010'
];
const GAMING_SUFFIXES = [
    'PL', 'X', 'TV', 'GG', 'Pro', 'Live', 'HD', 'EU', 'XD', 'FPS', 'EZ'
];

// Co piaty bot otrzymuje losowy ciag liter (5-10 znakow), np. "xarqelo".
// Nicki te nie maja z gory ustalonego znaczenia ani dopisywanego tagu.
function randomLetterNick() {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const length = 5 + Math.floor(Math.random() * 6);
    let result = '';
    for (let i = 0; i < length; i++) {
        result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    // Koncowka YT pozostaje wylaczona, rowniez przy losowym ciagu liter.
    if (result.toUpperCase().endsWith('YT')) return randomLetterNick();
    return result;
}

// Czasami (15%) dodaj 1-3 wielkie litery WEWNATRZ bazowej nazwy.
// Nie zmienia pierwszej litery ani doklejonej pozniej koncowki (PL, numer itd.).
function randomizeInternalCapitals(base) {
    if (Math.random() >= 0.15) return base;

    const letters = base.split('');
    const candidates = [];
    for (let i = 1; i < letters.length; i++) {
        // Wybieramy tylko male litery, zeby kazda zmiana byla widoczna.
        if (letters[i] >= 'a' && letters[i] <= 'z') candidates.push(i);
    }
    if (!candidates.length) return base;

    const roll = Math.random();
    const count = Math.min(candidates.length, roll < 0.55 ? 1 : (roll < 0.87 ? 2 : 3));
    for (let i = 0; i < count; i++) {
        // Losowanie bez powtorek: nie zmieniamy stale tej samej litery.
        const pick = Math.floor(Math.random() * candidates.length);
        const position = candidates.splice(pick, 1)[0];
        letters[position] = letters[position].toUpperCase();
    }
    return letters.join('');
}

class BotLoader {
    constructor(server) {
        this.server = server;
        this.botCount = 0;
        this.usedNames = new Set();
    }

    randomBotName() {
        // Ok. 40% nickow bez koncowki, 40% z cyfra i 20% z gamingowa koncowka.
        // Sprawdzamy tez nicki juz obecnych graczy, zeby ograniczyc kolizje nazw.
        for (let attempt = 0; attempt < 1000; attempt++) {
            // 20%: kompletnie losowy ciag liter; 80%: dotychczasowe naturalne nicki.
            const randomLetters = Math.random() < 0.20;
            const base = randomLetters
                ? randomLetterNick()
                : BASE_NICKS[Math.floor(Math.random() * BASE_NICKS.length)];
            let name = randomizeInternalCapitals(base); // 15% szans na wielkie litery w srodku.

            if (!randomLetters) {
                // W grupie naturalnych nazw: 40% bez koncowki, 40% cyfry, 20% tag.
                const style = Math.random();
                if (style >= 0.4 && style < 0.8) {
                    name += NUMBER_SUFFIXES[Math.floor(Math.random() * NUMBER_SUFFIXES.length)];
                } else if (style >= 0.8) {
                    // Nie doklejamy kolejnego tagu do nicku, ktory juz go ma (np. PLPL).
                    if (GAMING_SUFFIXES.some(tag => base.endsWith(tag))) continue;
                    name += GAMING_SUFFIXES[Math.floor(Math.random() * GAMING_SUFFIXES.length)];
                }
            }

            // Nazwy krotkie i czytelne, pasujace do rankingu i ekranu gry.
            if (name.length > 15 || this.usedNames.has(name)) continue;
            const occupied = this.server.clients.some(socket =>
                socket.player && socket.player._name === name
            );
            if (occupied) continue;

            this.usedNames.add(name);
            return name;
        }

        // Awaryjnie, gdyby pula byla juz zajeta.
        let fallback;
        do {
            fallback = 'Gracz' + Math.floor(Math.random() * 100000);
        } while (this.usedNames.has(fallback));
        this.usedNames.add(fallback);
        return fallback;
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
