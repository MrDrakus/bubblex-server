// BubbleX.pl - dodatkowa inteligencja botow dla istniejącego MultiOgarII.
// 20 botow: po 5 na poziom (poczatkujacy, sredni, dobry, ekspert).
// Nie tworzy polaczen WebSocket ani nie zmienia fizyki gry.

const PROFILES = [
    // Rowniejszy rozklad poziomow, a nie 20 identycznych botow.
    { name: 'Poczatkujacy', thinkTicks: 18, vision: 680,  caution: 0.70, aggression: 0.70, splitChance: 0.00, splitCooldown: 380, aimError: 95 },
    { name: 'Sredni',       thinkTicks: 12, vision: 980,  caution: 1.00, aggression: 1.00, splitChance: 0.15, splitCooldown: 290, aimError: 55 },
    { name: 'Dobry',        thinkTicks: 8,  vision: 1300, caution: 1.30, aggression: 1.25, splitChance: 0.35, splitCooldown: 220, aimError: 24 },
    { name: 'Ekspert',      thinkTicks: 5,  vision: 1750, caution: 1.65, aggression: 1.50, splitChance: 0.60, splitCooldown: 160, aimError: 8 }
];

class BubbleXBotAI {
    constructor(server) {
        this.server = server;
        this.created = 0;
    }

    // Funkcja wywolywana w Server.updateClients() po zwyklym updateTick() bota.
    update(bot) {
        if (!bot || !bot.cells || !bot.cells.length || !bot.mouse || bot.isRemoved)
            return;

        if (!bot._bubbleXAI) {
            const number = this.created++;
            // Pierwsze 5 latwe, nastepne 5 srednie itd.; przy ew. dodatkowych
            // botach profile powtarzaja sie cyklicznie.
            const level = Math.floor((number % 20) / 5);
            bot._bubbleXAI = {
                number,
                profile: PROFILES[level],
                nextThinkTick: 0,
                lastSplitTick: -10000,
                wander: null
            };
        }

        const brain = bot._bubbleXAI;
        const profile = brain.profile;
        const tick = this.server.ticks;
        if (tick < brain.nextThinkTick) {
            // Stary BotPlayer.updateTick() tez ustawia cel ruchu.
            // Odnawiaj ostatnia decyzje w KAZDYM ticku, inaczej bot
            // wykona nasz ruch tylko raz na kilkanascie aktualizacji.
            if (brain.lastAim) {
                bot.mouse.x = brain.lastAim.x;
                bot.mouse.y = brain.lastAim.y;
            }
            return;
        }
        brain.nextThinkTick = tick + profile.thinkTicks;

        const own = bot.cells.filter(c => c && !c.isRemoved && c.position && c.radius > 0);
        if (!own.length) return;
        const largest = own.reduce((a, b) => a.radius >= b.radius ? a : b);
        const smallest = own.reduce((a, b) => a.radius <= b.radius ? a : b);
        let cx = 0, cy = 0, weightSum = 0;
        for (const cell of own) {
            const weight = cell.radius * cell.radius;
            cx += cell.position.x * weight;
            cy += cell.position.y * weight;
            weightSum += weight;
        }
        if (!weightSum) return;
        cx /= weightSum;
        cy /= weightSum;

        const maxCells = this.server.config.playerMaxCells || 16;
        const visionSq = profile.vision * profile.vision;
        let fleeX = 0, fleeY = 0, dangerStrength = 0;
        let bestPrey = null, bestPreyScore = -Infinity;
        let nearestFood = null, bestFoodScore = -Infinity;

        // Wrogowie, bez teleportow i bez wiedzy o calej mapie:
        // bot widzi tylko obiekty w zasiegu swojego poziomu.
        for (const cell of this.server.nodesPlayer) {
            if (!cell || cell.isRemoved || !cell.owner || cell.owner === bot || !cell.position)
                continue;
            if (this.server.mode.haveTeams && cell.owner.team === bot.team)
                continue;
            const dx = cell.position.x - cx;
            const dy = cell.position.y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 > visionSq) continue;
            const d = Math.max(1, Math.sqrt(d2));

            // Ucieczka przed komorkami, ktore moga zjesc nasze mniejsze czesci.
            // Im inteligentniejszy bot, tym wczesniej reaguje.
            if (cell.radius > smallest.radius * 1.16) {
                const safeDistance = (240 + cell.radius * 2.25 + largest.radius) * profile.caution;
                if (d < safeDistance) {
                    const strength = ((safeDistance - d) / safeDistance) *
                        Math.min(3, cell.radius / Math.max(1, smallest.radius));
                    fleeX -= (dx / d) * strength;
                    fleeY -= (dy / d) * strength;
                    dangerStrength += strength;
                }
            }

            // Polowanie na graczy mozliwych do zjedzenia. Wspolczynnik 1.15
            // odpowiada warunkowi kolizji w Server.js; zachowujemy margines.
            if (largest.radius > cell.radius * 1.26) {
                const score = (16 + cell.radius * 0.10) * profile.aggression - d * 0.020;
                if (score > bestPreyScore) {
                    bestPrey = { cell, d, dx, dy };
                    bestPreyScore = score;
                }
            }
        }

        // Zielone wirusy: gdy nie ma jeszcze maksymalnego podzialu i mozemy
        // zostac rozerwani, inteligentniejszy bot je omija.
        if (own.length < maxCells) {
            for (const v of this.server.nodesVirus) {
                if (!v || v.isRemoved || !v.position) continue;
                if (largest.radius < v.radius * 1.17) continue;
                const dx = v.position.x - cx;
                const dy = v.position.y - cy;
                const d = Math.max(1, Math.hypot(dx, dy));
                const radius = (largest.radius + v.radius + 85) * profile.caution;
                if (d >= radius) continue;
                const strength = (radius - d) / radius * 1.2;
                fleeX -= dx / d * strength;
                fleeY -= dy / d * strength;
                dangerStrength += strength;
            }
        }

        // Zbieranie jedzenia i ewentualnie wyrzuconej masy.
        // Nie wykonujemy zadnych zapytan do bazy ani dodatkowego renderowania.
        const foodArrays = [this.server.nodesFood, this.server.nodesEjected];
        for (const foods of foodArrays) {
            for (const food of foods) {
                if (!food || food.isRemoved || !food.position) continue;
                const dx = food.position.x - cx;
                const dy = food.position.y - cy;
                const d2 = dx * dx + dy * dy;
                if (d2 > visionSq) continue;
                const d = Math.sqrt(d2);
                // Szukaj bliskiego, latwo dostepnego jedzenia.
                const score = 12 + Math.min(40, food.radius) * 0.13 - d * 0.022;
                if (score > bestFoodScore) {
                    bestFoodScore = score;
                    nearestFood = food;
                }
            }
        }

        let aimX, aimY;
        if (dangerStrength > 0.45) {
            // W razie bezposredniego zagrozenia priorytetem jest ucieczka.
            const len = Math.max(0.01, Math.hypot(fleeX, fleeY));
            aimX = cx + (fleeX / len) * 1000;
            aimY = cy + (fleeY / len) * 1000;
        } else if (bestPrey && (bestPreyScore > bestFoodScore + 1 || !nearestFood)) {
            // Gon slabszego gracza.
            aimX = bestPrey.cell.position.x;
            aimY = bestPrey.cell.position.y;
            const victim = bestPrey.cell;
            const canSplit = own.length < maxCells &&
                largest.radius >= this.server.config.playerMinSplitSize &&
                largest.radius > victim.radius * 1.85 &&
                bestPrey.d > largest.radius * 0.7 &&
                bestPrey.d < 300 + largest.radius * 1.2 &&
                dangerStrength < 0.2 &&
                tick - brain.lastSplitTick >= profile.splitCooldown &&
                Math.random() < profile.splitChance;
            if (canSplit) {
                bot.mouse.x = aimX;
                bot.mouse.y = aimY;
                this.server.splitCells(bot); // Odpowiednik nacisniecia spacji.
                brain.lastSplitTick = tick;
            }
        } else if (nearestFood) {
            aimX = nearestFood.position.x;
            aimY = nearestFood.position.y;
        } else {
            // Brak jedzenia w polu widzenia: rozgladaj sie po mapie.
            if (!brain.wander || Math.hypot(brain.wander.x - cx, brain.wander.y - cy) < 120 ||
                tick >= brain.wander.until) {
                const angle = Math.random() * 2 * Math.PI;
                brain.wander = {
                    x: cx + Math.cos(angle) * 700,
                    y: cy + Math.sin(angle) * 700,
                    until: tick + 300 + Math.random() * 300
                };
            }
            aimX = brain.wander.x;
            aimY = brain.wander.y;
        }

        // Slabsi gracze czasem nietrafnie celuja, lepsi sa precyzyjniejsi.
        // Losujemy odchylenie tylko przy zmianie decyzji (nie co klatke).
        if (profile.aimError > 0 && dangerStrength <= 0.45) {
            aimX += (Math.random() - 0.5) * profile.aimError;
            aimY += (Math.random() - 0.5) * profile.aimError;
        }

        // Nie pozwalaj botom uciekac poza plansze.
        const border = this.server.border;
        if (border) {
            aimX = Math.max(border.minx + 60, Math.min(border.maxx - 60, aimX));
            aimY = Math.max(border.miny + 60, Math.min(border.maxy - 60, aimY));
        }
        if (Number.isFinite(aimX) && Number.isFinite(aimY)) {
            bot.mouse.x = aimX;
            bot.mouse.y = aimY;
            brain.lastAim = { x: aimX, y: aimY };
        }
    }
}

module.exports = BubbleXBotAI;
