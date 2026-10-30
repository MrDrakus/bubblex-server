const Player = require('../Player');
const Vec2 = require('../modules/Vec2');

class BotPlayer extends Player {
    constructor(server, socket) {
        super(server, socket);
        this.isBot = true;
        this.splitCooldown = 0; // Odblokowujemy spację, ale sterujemy nią bezpiecznie
        this.intelligence = Math.random() * 0.6 + 0.7;

        this.targetNode = null;
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
            this.targetNode = null;
            return;
        }

        // Sprawdzamy, czy obecny cel nadal istnieje
        if (this.targetNode) {
            let exists = false;
            for (const node of this.viewNodes) {
                if (node === this.targetNode) {
                    exists = true;
                    break;
                }
            }
            if (!exists || this.targetNode.isRemoved) {
                this.targetNode = null;
            }
        }

        // Szukanie celu: jedzenie LUB mniejszy gracz (żeby mogły Cię atakować!)
        if (!this.targetNode) {
            let minDist = Infinity;
            for (const node of this.viewNodes) {
                if (node.owner == this) continue;

                // Ignorujemy wirusy (typ 2)
                if (node.type === 2) continue;

                // Jeśli to gracz, atakujemy go tylko wtedy, gdy jest mniejszy od bota
                if (node.owner && node.radius >= cell.radius * 0.9) continue; 

                const dist = node.position.difference(cell.position).dist();
                if (dist < minDist && dist < 700) {
                    minDist = dist;
                    this.targetNode = node;
                }
            }
        }

        let targetPos = null;

        // GŁÓWNY RUCH Z PROJEKCJĄ KIERUNKU (zapobiega drżeniu):
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

            // KONTROLOWANE UŻYCIE SPACJI (Atak / Podział):
            // Bot użyje spacji tylko wtedy, gdy goni gracza/atrakcyjny cel, jest odpowiednio duży i minął cooldown
            if (this.targetNode.owner && dist < 350 && cell.mass > 45 && this.splitCooldown <= 0) {
                this.socket.client.splitRequested = true;
                this.splitCooldown = 40; // Odstęp między użyciami spacji
            }

            this.wanderTarget = cell.position.clone();
        } 
        else {
            // BRAK CELU: Spokojny patrol po okolicy
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

        if (this.splitCooldown > 0) this.splitCooldown--;
        this.mouse.assign(targetPos);
    }
}

module.exports = BotPlayer;
