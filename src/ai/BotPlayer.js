const Player = require('../Player');
const Vec2 = require('../modules/Vec2');

class BotPlayer extends Player {
    constructor(server, socket) {
        super(server, socket);
        this.isBot = true;
        this.splitCooldown = 999999;
        this.intelligence = Math.random() * 0.6 + 0.7;

        this.targetFood = null;
        // Zaczynamy z punktem patrolu przed botem
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
            this.mouse.assign(new Vec2(0, 0));
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

        // Jeśli nie ma celu, szukamy najbliższego jedzenia w promieniu 600 px
        if (!this.targetFood) {
            let minDist = Infinity;
            for (const node of this.viewNodes) {
                if (node.owner == this) continue;
                // Interesuje nas tylko jedzenie lub mniejsze obiekty (typ 1)
                const dist = node.position.difference(cell.position).dist();
                if (dist < minDist && dist < 600) {
                    minDist = dist;
                    this.targetFood = node;
                }
            }
        }

        // GŁÓWNY RUCH:
        if (this.targetFood) {
            // Jedzie prosto do wybranego jedzenia
            this.mouse.assign(this.targetFood.position);
            // Aktualizujemy punkt patrolu na bieżącą pozycję, żeby po zjedzeniu nie skakał
            this.wanderTarget = cell.position.clone();
        } 
        else {
            // BRAK JEDZENIA: Spokojny patrol
            if (!this.wanderTarget || cell.position.difference(this.wanderTarget).dist() < 150) {
                // Wybieramy nowy losowy punkt w pobliżu, zamiast skakać przez całą mapę
                const angle = Math.random() * Math.PI * 2;
                const distance = 300 + Math.random() * 400;
                this.wanderTarget = new Vec2(
                    cell.position.x + Math.cos(angle) * distance,
                    cell.position.y + Math.sin(angle) * distance
                );
            }
            this.mouse.assign(this.wanderTarget);
        }
    }
}

module.exports = BotPlayer;
