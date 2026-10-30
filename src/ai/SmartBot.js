class SmartBot {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.size = 20; // Początkowy rozmiar/masa
        this.speed = 3;  // Prędkość poruszania się
    }

    // Główna pętla aktualizująca zachowanie bota w każdym ticku serwera
    update(visibleEntities) {
        let nearestThreat = null;
        let nearestFood = null;
        let nearestPrey = null;

        let minThreatDist = Infinity;
        let minFoodDist = Infinity;
        let minPreyDist = Infinity;

        // Skanowanie otoczenia widocznego dla bota
        for (let entity of visibleEntities) {
            let dist = Math.hypot(entity.x - this.x, entity.y - this.y);

            if (entity.type === 'player' && entity.size > this.size * 1.1) {
                // Zagrożenie (większy gracz / bot)
                if (dist < minThreatDist) {
                    minThreatDist = dist;
                    nearestThreat = entity;
                }
            } else if (entity.type === 'player' && entity.size < this.size * 0.9) {
                // Cel do zjedzenia (mniejszy gracz)
                if (dist < minPreyDist) {
                    minPreyDist = dist;
                    nearestPrey = entity;
                }
            } else if (entity.type === 'pellet' || entity.type === 'food') {
                // Zwykłe jedzenie
                if (dist < minFoodDist) {
                    minFoodDist = dist;
                    nearestFood = entity;
                }
            }
        }

        // 1. Priorytet: Ucieczka przed zagrożeniem (jeśli jest blisko)
        if (nearestThreat && minThreatDist < 350) {
            this.moveAwayFrom(nearestThreat);
            return;
        }

        // 2. Priorytet: Atak na mniejszego gracza
        if (nearestPrey && minPreyDist < 400) {
            this.moveTo(nearestPrey);
            return;
        }

        // 3. Priorytet: Zbieranie jedzenia
        if (nearestFood) {
            this.moveTo(nearestFood);
        }
    }

    moveTo(target) {
        let angle = Math.atan2(target.y - this.y, target.x - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
    }

    moveAwayFrom(target) {
        let angle = Math.atan2(this.y - target.y, this.x - target.x);
        this.x += Math.cos(angle) * (this.speed * 1.2); // Ucieka nieco szybciej
        this.y += Math.sin(angle) * (this.speed * 1.2);
    }
}

module.exports = SmartBot;
