const Player = require('../Player');
const Vec2 = require('../modules/Vec2');

class BotPlayer extends Player {
    constructor(server, socket) {
        super(server, socket);
        this.isBot = true;
        this.splitCooldown = 999999; // Całkowicie blokujemy split u botów, żeby się nie rozdzielały i nie wariowały
        this.targetNode = null;     // Pamięć obecnego celu, żeby bot nie skakał między kulek
        this.targetTicks = 0;       // Licznik czasu trzymania celu

        this.intelligence = Math.random() * 0.6 + 0.7;
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
        this.decide(this.largest(this.cells));
    }

    decide(cell) {
        if (!cell) return;

        // ZABEZPIECZENIE PRZED ŚCIANAMI:
        const border = this.server.border;
        const margin = 200;

        if (cell.position.x < border.minx + margin || cell.position.x > border.maxx - margin ||
            cell.position.y < border.miny + margin || cell.position.y > border.maxy - margin) {
            
            // Ucieczka prosto do środka mapy (0,0)
            const center = new Vec2(0, 0);
            const toCenter = center.difference(cell.position).normalize();
            this.mouse.assign(cell.position.sum(toCenter.product(1000)));
            this.targetNode = null;
            return;
        }

        // PAMIĘĆ CELU: Sprawdzamy, czy obecny cel nadal istnieje i jest blisko
        if (this.targetNode) {
            // Jeśli cel zniknął, został zjedzony lub minęło za dużo czasu, szukamy nowego
            const distToTarget = this.targetNode.position.difference(cell.position).dist();
            if (!this.targetNode.owner && (this.targetNode.isRemoved || distToTarget > 600 || this.targetTicks <= 0)) {
                this.targetNode = null;
            } else {
                this.targetTicks--;
            }
        }

        // Jeśli bot nie ma celu, wybiera nowy najbliższy obiekt jedzenia
        if (!this.targetNode) {
            let minDistance = Infinity;
            for (const node of this.viewNodes) {
                if (node.owner == this) continue;
                // Interesuje nas głównie jedzenie (typ 1) lub mniejsze obiekty
                const distance = node.position.difference(cell.position).dist();
                if (distance < minDistance && distance < 700) {
                    minDistance = distance;
                    this.targetNode = node;
                }
            }
            // Ustawiamy licznik klatek, przez które bot będzie płynął do tego celu
            this.targetTicks = 15; 
        }

        // JAZDA DO CELU LUB PRZED SIEBIE
        if (this.targetNode) {
            this.mouse.assign(this.targetNode.position);
        } else {
            // Brak celów w pobliżu -> płynie stabilnie przed siebie w losowym, ale stałym kierunku
            this.mouse.assign(cell.position.sum(new Vec2(300, 300)));
        }
    }
}

module.exports = BotPlayer;
