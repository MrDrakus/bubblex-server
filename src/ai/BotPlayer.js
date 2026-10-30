const Player = require('../Player');
const Vec2 = require('../modules/Vec2');

class BotPlayer extends Player {
    constructor(server, socket) {
        super(server, socket);
        this.isBot = true;
        this.splitCooldown = 999999;
        this.intelligence = Math.random() * 0.6 + 0.7;

        this.targetFood = null; // Stały cel, którego bot się trzyma
        this.wanderTarget = new Vec2(
            (Math.random() - 0.5) * 3000,
            (Math.random() - 0.5) * 3000
        );
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
            this.mouse.assign(new Vec2(0, 0));
            this.targetFood = null;
            return;
        }

        // Sprawdzamy, czy obecny cel nadal istnieje w polu widzenia
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

        // Jeśli bot nie ma celu, wybiera najbliższe jedzenie RAZ i trzyma się go
        if (!this.targetFood) {
            let minDist = Infinity;
            for (const node of this.viewNodes) {
                if (node.owner == this) continue;
                const dist = node.position.difference(cell.position).dist();
                if (dist < minDist && dist < 700) {
                    minDist = dist;
                    this.targetFood = node;
                }
            }
        }

        // JEŚLI MAMY CEL: jedziemy płynnie w jego stronę
        if (this.targetFood) {
            this.mouse.assign(this.targetFood.position);
        } 
        else {
            // PATROL: jeśli brak jedzenia, jedzie do punktu patrolu
            if (cell.position.difference(this.wanderTarget).dist() < 200) {
                this.wanderTarget = new Vec2(
                    (Math.random() - 0.5) * 3000,
                    (Math.random() - 0.5) * 3000
                );
            }
            this.mouse.assign(this.wanderTarget);
        }
    }
}

module.exports = BotPlayer;
