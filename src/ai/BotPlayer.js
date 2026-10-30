const Player = require('../Player');
const Vec2 = require('../modules/Vec2');

class BotPlayer extends Player {
    constructor(server, socket) {
        super(server, socket);
        this.isBot = true;
        this.splitCooldown = 999999; // Blokada spacji dla stuprocentowej stabilności
        this.intelligence = Math.random() * 0.6 + 0.7;

        this.targetFood = null;
        this.wanderTarget = null;
        this.targetTicks = 0; // Licznik czasu dla wybranego celu
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

        // ZABEZPIECZENIE PRZED ŚCIANAMI (łagodniejsze odbicie):
        const border = this.server.border;
        const margin = 150;

        if (cell.position.x < border.minx + margin || cell.position.x > border.maxx - margin ||
            cell.position.y < border.miny + margin || cell.position.y > border.maxy - margin) {
            const center = new Vec2(0, 0);
            const toCenter = center.difference(cell.position).normalize();
            this.mouse.assign(cell.position.sum(toCenter.product(1000)));
            this.targetFood = null;
            return;
        }

        // Sprawdzamy, czy obecny cel (jedzenie) nadal istnieje
        if (this.targetFood) {
            let exists = false;
            for (const node of this.viewNodes) {
                if (node === this.targetFood) {
                    exists = true;
                    break;
                }
            }
            this.targetTicks--;
            if (!exists || this.targetFood.isRemoved || this.targetTicks <= 0) {
                this.targetFood = null;
            }
        }

        // Szukamy WYŁĄCZNIE jedzenia (typ 1) - gracze i wirusy są ignorowani
        if (!this.targetFood) {
            let minDist = Infinity;
            for (const node of this.viewNodes) {
                if (node.owner == this) continue;
                if (node.type !== 1) continue; // <-- Tylko jedzenie! Zero polowań na graczy.

                const dist = node.position.difference(cell.position).dist();
                if (dist < minDist && dist < 600) {
                    minDist = dist;
                    this.targetFood = node;
                }
            }
            this.targetTicks = 35; // Bot trzyma cel przez chwilę, po czym szuka nowego
        }

        let targetPos = null;

        // RUCH DO JEDZENIA LUB PATROL
        if (this.targetFood) {
            const diff = this.targetFood.position.difference(cell.position);
            const dist = diff.dist();

            if (dist < 5) {
                targetPos = cell.position.sum(new Vec2(100, 0));
                this.targetFood = null;
            } else {
                const direction = diff.normalize();
                targetPos = cell.position.sum(direction.product(1000));
            }
            this.wanderTarget = cell.position.clone();
        } 
        else {
            // PATROL: Jeśli brak jedzenia w zasięgu, bot płynnie krąży po okolicy
            if (!this.wanderTarget || cell.position.difference(this.wanderTarget).dist() < 100) {
                const angle = Math.random() * Math.PI * 2;
                const distance = 400 + Math.random() * 400;
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
