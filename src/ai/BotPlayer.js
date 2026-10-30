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
        const result = new Vec2(0, 0);

        for (const node of this.viewNodes) {
            if (node.owner == this) continue;

            const displacement = node.position.difference(cell.position);
            let distance = displacement.dist();

            // Głupsze boty mają mniejszy "zasięg wzroku" – ignorują obiekty zbyt daleko
            if (distance > 800 * this.intelligence) continue;

            // Make decisions
            let influence = decideTypes[node.type].call(this, node, cell);

            // Conclude decisions
            if (influence == 0) continue;

            if (influence < 0)
                distance -= cell.radius + node.radius; // Get edge distance

            if (distance < 1) distance = 1;
            
            // Mądrzejsze boty precyzyjniej kalkulują siłę odległości
            influence /= (distance * (2 - this.intelligence));

            // Splitting conditions
            if (this.intelligence > 0.95 && node.type != 1 && cell.radius > node.radius * 1.15 &&
                !this.splitCooldown && this.cells.length < 8 &&
                400 - cell.radius / 2 - node.radius >= distance)
            {
                // Splitkill the target
                this.splitCooldown = 15;
                this.mouse.assign(node.position);
                this.socket.client.splitRequested = true;
                return;
            } else {
                // Produce force vector exerted by this entity on the cell
                result.add(displacement.normalize().product(influence));
            }
        }

        // Dodajemy lekki losowy szum do ruchu mniej inteligentnych botów
        if (this.errorMargin > 0) {
            result.x += (Math.random() - 0.5) * this.errorMargin;
            result.y += (Math.random() - 0.5) * this.errorMargin;
        }

        this.mouse.assign(cell.position.sum(result.multiply(900)));
    }
}

module.exports = BotPlayer;
