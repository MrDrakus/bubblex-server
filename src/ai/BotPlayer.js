const Player = require('../Player');
const Vec2 = require('../modules/Vec2');

class BotPlayer extends Player {
    constructor(server, socket) {
        super(server, socket);
        this.isBot = true;
        this.splitCooldown = 0;
        this.intelligence = Math.random() * 0.6 + 0.7;

        this.targetNode = null;
        this.wanderTarget = null;
        this.targetTicks = 0;
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

        // Zabezpieczenie przed ścianami (płynne odbicie do środka)
        const border = this.server.border;
        const margin = 200;

        if (cell.position.x < border.minx + margin || cell.position.x > border.maxx - margin ||
            cell.position.y < border.miny + margin || cell.position.y > border.maxy - margin) {
            const center = new Vec2(0, 0);
            const toCenter = center.difference(cell.position).normalize();
            this.mouse.assign(cell.position.sum(toCenter.product(1000)));
            this.targetNode = null;
            return;
        }

        // Walidacja obecnego celu
        if (this.targetNode) {
            let exists = false;
            for (const node of this.viewNodes) {
                if (node === this.targetNode) {
                    exists = true;
                    break;
                }
            }
            this.targetTicks--;
            if (!exists || this.targetNode.isRemoved || this.targetTicks <= 0) {
                this.targetNode = null;
            }
        }

        // Wybór celu: jedzenie LUB mniejszy gracz/bot (wzajemne ataki!)
        if (!this.targetNode) {
            let bestScore = -Infinity;
            for (const node of this.viewNodes) {
                if (node.owner === this) continue;
                if (node.type === 2) continue; // Ignorujemy wirusy

                const dist = node.position.difference(cell.position).dist();
                if (dist > 800) continue;

                let score = 0;
                if (node.type === 1) {
                    score = 1000 - dist; // Jedzenie
                } else if (node.owner && node.radius < cell.radius * 0.85) {
                    score = 5000 - dist + (cell.radius - node.radius); // Mniejszy gracz/bot do zjedzenia
                } else {
                    continue;
                }

                if (score > bestScore) {
                    bestScore = score;
                    this.targetNode = node;
                }
            }
            this.targetTicks = 25;
        }

        let targetPos = null;

        if (this.targetNode) {
            const diff = this.targetNode.position.difference(cell.position);
            const dist = diff.dist();

            if (dist < 5) {
                targetPos = cell.position.sum(new Vec2(100, 0));
                this.targetNode = null;
            } else {
                const direction = diff.normalize();
                targetPos = cell.position.sum(direction.product(1000));
            }

            // Kontrolowane użycie spacji do ataku na innego gracza/bota
            if (this.targetNode.owner && dist < 400 && cell.mass > 36 && this.splitCooldown <= 0) {
                if (cell.mass > this.targetNode.mass * 2) {
                    this.socket.client.splitRequested = true;
                    this.splitCooldown = 50;
                }
            }

            this.wanderTarget = cell.position.clone();
        } else {
            // Spokojny patrol, gdy brak celów w pobliżu
            if (!this.wanderTarget || cell.position.difference(this.wanderTarget).dist() < 150) {
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

        if (this.splitCooldown > 0) this.splitCooldown--;
        this.mouse.assign(targetPos);
    }
}

module.exports = BotPlayer;
