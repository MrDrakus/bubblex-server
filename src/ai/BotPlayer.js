const Player = require('../Player');
const Vec2 = require('../modules/Vec2');

const decideTypes = [
    function decidePlayer(node, cell) {
        // Same team, don't eat
        if (this.server.mode.haveTeams && cell.owner.team == node.owner.team)
            return 0;
        if (cell.radius > node.radius * 1.15) // Edible
            return node.radius * 2.5;
        if (node.radius > cell.radius * 1.15) // Bigger, avoid
            return -node.radius;
        return -(node.radius / cell.radius) / 3;
    },
    function decideFood(node, cell) { // Always edible
        return 1;
    },
    function decideEjected(node, cell) {
        return (cell.radius > node.radius * 1.15) ? node.radius : 0;
    },
    function decideVirus(node, cell) {
        if (cell.radius > node.radius * 1.15) { // Edible
            if (this.cells.length == this.server.config.playerMaxCells) {
                // Reached cell limit, won't explode
                return node.radius * 2.5;
            }
            // Will explode, avoid
            return -1;
        }
        // Avoid mother cell if bigger than player
        return (node.isMotherCell && node.radius > cell.radius * 1.15) ? -1 : 0;
    }
];

class BotPlayer extends Player {
    constructor(server, socket) {
        super(server, socket);
        this.isBot = true;
        this.splitCooldown = 0;

        // Losujemy poziom sprytu bota od 0.7 (głupszy/ostrożniejszy) do 1.3 (mądrzejszy)
        this.intelligence = Math.random() * 0.6 + 0.7;
        // Współczynnik błędu (im mniejsza inteligencja, tym większy chaos w ruchu)
        this.errorMargin = (1.5 - this.intelligence) * 40;
    }

    largest(list) {
        return list.reduce((largest, current) =>
            current.radius > largest.radius ? current : largest);
    }

    checkConnection() {
        // Respawn if bot is dead
        if (!this.cells.length)
            this.server.mode.onPlayerSpawn(this.server, this);
    }

    sendUpdate() {
        if (this.splitCooldown) --this.splitCooldown;
        this.decide(this.largest(this.cells));
    }
decide(cell) {
        if (!cell) return;

        // Szukamy najbliższego jedzenia lub atrakcyjnego obiektu
        let closestTarget = null;
        let minDistance = Infinity;

        for (const node of this.viewNodes) {
            if (node.owner == this) continue;

            // Ignorujemy duże obiekty, jeśli bot jest za mały (uproszczone dla płynności)
            const displacement = node.position.difference(cell.position);
            const distance = displacement.dist();

            if (distance < minDistance && distance < 800 * this.intelligence) {
                minDistance = distance;
                closestTarget = node;
            }
        }

        // ZABEZPIECZENIE PRZED ŚCIANAMI:
        const border = this.server.border;
        const margin = 200;

        if (cell.position.x < border.minx + margin || cell.position.x > border.maxx - margin ||
            cell.position.y < border.miny + margin || cell.position.y > border.maxy - margin) {
            
            // Ucieczka do środka mapy (0,0)
            const center = new Vec2(0, 0);
            const toCenter = center.difference(cell.position).normalize();
            this.mouse.assign(cell.position.sum(toCenter.product(1000)));
            return;
        }

        // JEŚLI BOT WIDZI CEL (np. jedzenie): płynie prosto do niego
        if (closestTarget) {
            this.mouse.assign(closestTarget.position);
        } else {
            // JEŚLI BRAK CELU: jedzie prosto przed siebie (brak kręcenia się w miejscu)
            this.mouse.assign(cell.position.sum(new Vec2(500, 0)));
        }
    }
module.exports = BotPlayer;
