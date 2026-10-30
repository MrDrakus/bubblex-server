const Player = require('../Player');
const Vec2 = require('../modules/Vec2');

class BotPlayer extends Player {
    constructor(server, socket) {
        super(server, socket);
        this.isBot = true;
        this.splitCooldown = 999999;
        this.intelligence = Math.random() * 0.6 + 0.7;

        this.targetFood = null;
        this.wanderTarget = null;
    }

    largest(list) {
        return list.reduce((largest, current) =>
            current.radius > largest.radius ? current : largest);
    }

    checkConnection() {
        if (!this.cells.length)
            this.server.mode.onPlayerSpawn(this.server, this);
    }

    sendUpdate() {
        const cell = this.largest(this.cells);
        if (!cell) return;

        // ZABEZPIECZENIE PRZED ŚCIANAMI:
        const border = this.server.border;
        const margin = 300;

        if (cell.position.x < border.minx + margin || cell.position.x > border.maxx - margin ||
            cell.position.y < border.miny + margin || cell.position.y > border.maxy - margin) {
            const center = new Vec2(0, 0);
            const toCenter = center.difference(cell.position).normalize();
            this.mouse.assign(cell.position.sum(toCenter.product(1000)));
            this.targetFood = null;
            return;
        }

        // Sprawdzamy czy obecny cel nadal żyje i jest w zasięgu wzroku
        if (this.targetFood) {
            let exists = false;
            for (const node of this.viewNodes) {
                if (node === this.targetFood) {
                    exists = true;
                    break;
                }
            }
            if (!exists || this.targetFood.isRemoved) {
                this.targetFood = null;
            }
        }

        // Jeśli nie ma celu, szukamy WYŁĄCZNIE JEDZENIA (typ 1) w promieniu 600 px
        if (!this.targetFood) {
            let minDist = Infinity;
            for (const node of this.viewNodes) {
                if (node.owner == this) continue;
                if (node.type !== 1) continue; // <-- KLUCZOWE: ignorujemy wirusy i graczy, bierzemy tylko jedzenie!

                const dist = node.position.difference(cell.position).dist();
                if (dist < minDist && dist < 600) {
                    minDist = dist;
                    this.targetFood = node;
                }
            }
        }

        let targetPos = null;

        // GŁÓWNY RUCH Z BEZPIECZNĄ PROJEKCJĄ KIERUNKU:
        if (this.targetFood) {
            const diff = this.targetFood.position.difference(cell.position);
            const dist = diff.dist();

            // Jeśli bot jest już ekstremalnie blisko jedzenia, gładko jedziemy naprzód zamiast dzielić przez zero
            if (dist < 5) {
                targetPos = cell.position.sum(new Vec2(100, 0));
                this.targetFood = null; // Cel zjedzony, szukamy nowego
            } else {
                const direction = diff.normalize();
                targetPos = cell.position.sum(direction.product(1000));
            }
            this.wanderTarget = cell.position.clone();
        } 
        else {
            // BRAK JEDZENIA: Spokojny patrol
            if (!this.wanderTarget || cell.position.difference(this.wanderTarget).dist() < 150) {
                const angle = Math.random() * Math.PI * 2;
                const distance = 300 + Math.random() * 400;
                this.wanderTarget = new Vec2(
                    cell.position.x + Math.cos(angle) * distance,
                    cell.position.y + Math.sin(angle) * distance
                );
            }
            const diffPatrol = this.wanderTarget.difference(cell.position);
            if (diffPatrol.dist() < 5) {
                targetPos = cell.position.sum(new Vec2(100, 0));
            } else {
                const direction = diffPatrol.normalize();
                targetPos = cell.position.sum(direction.product(1000));
            }
        }

        this.mouse.assign(targetPos);
    }
}

module.exports = BotPlayer;
