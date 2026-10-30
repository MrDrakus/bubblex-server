const Player = require('../Player');
const Vec2 = require('../modules/Vec2');

class MinionPlayer extends Player {
    constructor(server, socket, owner) {
        super(server, socket);
        this.owner = owner;
        this.isMi = true;
        this.socket.isConnected = true;
    }

    remove() {
        this.socket.close();
        this.isRemoved = true;
        while (this.cells.length)
            this.server.removeNode(this.cells[0]);
    }

    checkConnection() {
        if (this.socket.isCloseRequest ||
            !this.owner.socket.isConnected ||
            !this.owner.hasMinions) return this.remove();

        if (!this.cells.length)
            this.server.mode.onPlayerSpawn(this.server, this);

        this.frozen = this.owner.minionFrozen;
        this.socket.client.splitRequested = this.owner.minionSplit;
        this.socket.client.ejectRequested = this.owner.minionEject;

        const cell = this.cells[0];
        if (!cell) {
            this.mouse = this.owner.mouse.clone();
            return;
        }

        // Bezpieczne mapowanie pozycji myszy właściciela dla miniona,
        // zapobiegające drżeniu, gdy kursor właściciela pokrywa się z minionem
        const ownerMouse = this.owner.mouse;
        const diff = ownerMouse.difference(cell.position);
        const dist = diff.dist();

        if (dist < 5) {
            // Jeśli kursor właściciela jest na minionie, wymuszamy ruch naprzód zamiast drżenia
            this.mouse = cell.position.sum(new Vec2(100, 0));
        } else {
            // Rzutujemy kursor w kierunku myszy właściciela, ale zachowujemy bezpieczny dystans
            const direction = diff.normalize();
            this.mouse = cell.position.sum(direction.product(1000));
        }
    }
}

module.exports = MinionPlayer;
