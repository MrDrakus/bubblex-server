const Player = require('../Player');
const Vec2 = require('../modules/Vec2');

class BotPlayer extends Player {
    constructor(server, socket) {
        super(server, socket);
        this.isBot = true;
        this.splitCooldown = 999999; // Blokada podziału, żeby się nie rozkraczały
        this.intelligence = Math.random() * 0.6 + 0.7;

        // Losowy punkt patrolu na mapie, do którego bot będzie dążył, gdy nie widzi jedzenia
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
            
            // Ucieczka do środka mapy (0,0) jeśli za blisko krawędzi
            this.mouse.assign(new Vec2(0, 0));
            return;
        }

        // Szukamy najbliższego jedzenia w polu widzenia bota
        let closestFood = null;
        let minDist = Infinity;

        for (const node of this.viewNodes) {
            if (node.owner == this) continue;
            
            const dist = node.position.difference(cell.position).dist();
            if (dist < minDist && dist < 700) {
                minDist = dist;
                closestFood = node;
            }
        }

        // JEŚLI WIDZI JEDZENIE: jedzie prosto do niego
        if (closestFood) {
            this.mouse.assign(closestFood.position);
        } 
        else {
            // JEŚLI NIE WIDZI JEDZENIA: jedzie do swojego punktu patrolu
            if (cell.position.difference(this.wanderTarget).dist() < 200) {
                // Gdy dotrze do celu, losuje nowy punkt na mapie
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
