const Player = require('../Player');
const Vec2 = require('../modules/Vec2');

class BotPlayer extends Player {
    constructor(server, socket) {
        super(server, socket);
        this.isBot = true;
        this.splitCooldown = 0;
        this.intelligence = Math.random() * 0.6 + 0.7;

        this.targetNode = null;
        this.moveAngle = Math.random() * Math.PI * 2;
        this.changeDirTimer = 0;
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

        const border = this.server.border;
        const margin = 300;

        // 1. Zabezpieczenie przed ścianami: natychmiastowy zwrot do środka mapy
        if (cell.position.x < border.minx + margin || cell.position.x > border.maxx - margin ||
            cell.position.y < border.miny + margin || cell.position.y > border.maxy - margin) {
            const centerX = (border.minx + border.maxx) / 2;
            const centerY = (border.miny + border.maxy) / 2;
            const centerVec = new Vec2(centerX, centerY);
            
            this.moveAngle = centerVec.difference(cell.position).angle();
            this.targetNode = null; // Gasi cel, żeby uciec od ściany
            this.mouse.assign(cell.position.sum(new Vec2(Math.cos(this.moveAngle) * 1000, Math.sin(this.moveAngle) * 1000)));
            return;
        }

        // 2. Sprawdzanie i walidacja obecnego celu
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
            } else {
                // KLUCZOWE: Jeśli bot jest już blisko celu (< 40px), odpuszcza go, 
                // żeby nie jitterować (nie trząść się) nad samą kropką jedzenia!
                const dist = this.targetNode.position.difference(cell.position).dist();
                if (dist < 40) {
                    this.targetNode = null;
                }
            }
        }

        // 3. Szukanie nowego celu (jedzenie lub mniejszy gracz)
        if (!this.targetNode) {
            let bestTarget = null;
            let minDist = Infinity;

            for (const node of this.viewNodes) {
                if (node.owner === this) continue;
                if (node.type === 2) continue; // Ignorujemy wirusy

                // Atakujemy gracza/bota tylko wtedy, gdy jest mniejszy
                if (node.owner && node.radius >= cell.radius * 0.85) continue;

                const dist = node.position.difference(cell.position).dist();
                if (dist < minDist && dist < 600) {
                    minDist = dist;
                    bestTarget = node;
                }
            }

            if (bestTarget) {
                this.targetNode = bestTarget;
            }
        }

        // 4. Sterowanie ruchem za pomocą stabilnego kąta
        if (this.targetNode) {
            const diff = this.targetNode.position.difference(cell.position);
            this.moveAngle = diff.angle(); // Używamy stabilnego kąta zamiast surowego wektora

            // Rzutujemy mysz daleko wprzód w kierunku celu
            this.mouse.assign(cell.position.sum(new Vec2(
                Math.cos(this.moveAngle) * 1000,
                Math.sin(this.moveAngle) * 1000
            )));

            // Użycie spacji (podziału) do ataku na mniejszego gracza
            if (this.targetNode.owner && diff.dist() < 400 && cell.mass > 40 && this.splitCooldown <= 0) {
                if (cell.mass > this.targetNode.mass * 1.5) {
                    if (typeof this.split === 'function') {
                        this.split();
                    } else {
                        this.socket.client.splitRequested = true;
                    }
                    this.splitCooldown = 50;
                }
            }
        } else {
            // Płynny patrol, gdy brak celów w pobliżu
            this.changeDirTimer--;
            if (this.changeDirTimer <= 0) {
                this.moveAngle += (Math.random() - 0.5) * 1.0;
                this.changeDirTimer = Math.floor(Math.random() * 50) + 25;
            }

            this.mouse.assign(cell.position.sum(new Vec2(
                Math.cos(this.moveAngle) * 1000,
                Math.sin(this.moveAngle) * 1000
            )));
        }

        if (this.splitCooldown > 0) this.splitCooldown--;
    }
}

module.exports = BotPlayer;
