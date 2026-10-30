const Player = require('../Player');
const Vec2 = require('../modules/Vec2');

class BotPlayer extends Player {
    constructor(server, socket) {
        super(server, socket);
        this.isBot = true;
        this.splitCooldown = 0;
        this.intelligence = Math.random() * 0.6 + 0.7;

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
        const margin = 400; // Zwiększony margines, żeby bot reagował wcześniej przed ścianą

        // 1. SILNE ODBICIE OD ŚCIAN: Natychmiastowo kierujemy bota do środka mapy, gdy podjdzie za blisko krawędzi
        if (cell.position.x < border.minx + margin || cell.position.x > border.maxx - margin ||
            cell.position.y < border.miny + margin || cell.position.y > border.maxy - margin) {
            
            const centerX = (border.minx + border.maxx) / 2;
            const centerY = (border.miny + border.maxy) / 2;
            const centerVec = new Vec2(centerX, centerY);
            
            this.moveAngle = centerVec.difference(cell.position).angle();
            this.mouse.assign(cell.position.sum(new Vec2(Math.cos(this.moveAngle) * 1000, Math.sin(this.moveAngle) * 1000)));
            return;
        }

        // 2. Szukanie jedzenia lub mniejszego gracza/bota
        let bestTarget = null;
        let minDist = Infinity;

        for (const node of this.viewNodes) {
            if (node.owner === this) continue;
            if (node.type === 2) continue; // Ignorujemy wirusy

            // Jeśli to gracz/bot, atakujemy tylko gdy jest mniejszy
            if (node.owner && node.radius >= cell.radius * 0.85) continue;

            const dist = node.position.difference(cell.position).dist();
            if (dist < minDist && dist < 700) {
                minDist = dist;
                bestTarget = node;
            }
        }

        // 3. Ruch i aktywne użycie spacji (funkcja split() zamiast samej flaki klienta)
        if (bestTarget) {
            const diff = bestTarget.position.difference(cell.position);
            const dist = diff.dist();

            if (dist < 5) {
                this.mouse.assign(cell.position.sum(new Vec2(100, 0)));
            } else {
                const direction = diff.normalize();
                this.mouse.assign(cell.position.sum(direction.product(1000)));
            }

            // BEZPOŚREDNIE WYWOŁANIE PODZIAŁU (SPACJA)
            if (bestTarget.owner && dist < 450 && cell.mass > 36 && this.splitCooldown <= 0) {
                if (cell.mass > bestTarget.mass * 1.5) {
                    // Wywołujemy natywne rozdzielenie gracza w MultiOgar
                    if (typeof this.split === 'function') {
                        this.split();
                    } else {
                        this.socket.client.splitRequested = true;
                    }
                    this.splitCooldown = 40; // Cooldown, żeby nie spamować
                }
            }
        } else {
            // Płynny patrol po mapie
            this.changeDirTimer--;
            if (this.changeDirTimer <= 0) {
                this.moveAngle += (Math.random() - 0.5) * 1.5;
                this.changeDirTimer = Math.floor(Math.random() * 40) + 20;
            }

            const targetPos = cell.position.sum(new Vec2(
                Math.cos(this.moveAngle) * 1000,
                Math.sin(this.moveAngle) * 1000
            ));
            this.mouse.assign(targetPos);
        }

        if (this.splitCooldown > 0) this.splitCooldown--;
    }
}

module.exports = BotPlayer;
