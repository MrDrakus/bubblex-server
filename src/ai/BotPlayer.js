class BotPlayer extends Player {
    constructor(server, socket) {
        super(server, socket);
        this.isBot = true;
        this.splitCooldown = 0;

        // Losujemy poziom sprytu bota od 0.7 (głupszy) do 1.3 (mądrzejszy)
        this.intelligence = Math.random() * 0.6 + 0.7;
        
        // Współczynnik błędu (im mniejsza inteligencja, tym większy chaos w ruchu)
        this.errorMargin = (1.5 - this.intelligence) * 50; 
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
        if (this.splitCooldown) --this.splitCooldown;
        this.decide(this.largest(this.cells));
    }

    decide(cell) {
        if (!cell) return;
        const result = new Vec2(0, 0);

        for (const node of this.viewNodes) {
            if (node.owner == this) continue;

            // Głupsze boty mają ograniczony "zasięg wzroku" – ignorują obiekty zbyt daleko
            const displacement = node.position.difference(cell.position);
            let distance = displacement.dist();
            
            if (distance > 800 * this.intelligence) continue; // Ignorują odległe obiekty

            // Pobieramy bazową ocenę typu obiektu
            let influence = decideTypes[node.type].call(this, node, cell);

            if (influence == 0) continue;

            if (influence < 0)
                distance -= cell.radius + node.radius;

            if (distance < 1) distance = 1;
            
            // Mądrzejsze boty precyzyjniej oceniją odległość, głupsze się pomylą
            influence /= (distance * (2 - this.intelligence));

            // Szansa na agresywny split tylko dla inteligentniejszych botów
            if (this.intelligence > 1.0 && node.type != 1 && cell.radius > node.radius * 1.15 &&
                !this.splitCooldown && this.cells.length < 8 &&
                400 - cell.radius / 2 - node.radius >= distance)
            {
                this.splitCooldown = 15;
                this.mouse.assign(node.position);
                this.socket.client.splitRequested = true;
                return;
            } else {
                result.add(displacement.normalize().product(influence));
            }
        }

        // Dodajemy lekkie odchylenie losowe (szum) dla mniej inteligentnych botów, 
        // żeby ich ruch wyglądał bardziej naturalnie i "ludzko"
        if (this.errorMargin > 0) {
            result.x += (Math.random() - 0.5) * this.errorMargin;
            result.y += (Math.random() - 0.5) * this.errorMargin;
        }

        this.mouse.assign(cell.position.sum(result.multiply(900)));
    }
}
