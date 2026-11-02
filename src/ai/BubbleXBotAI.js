// BubbleX.pl — AI botow v2.
// 20 botow, cztery poziomy trudnosci po 5 botow.
// Dziala z istniejacym Server.js wywolujacym bubbleXBotAI.update(bot).
// Nie zmienia fizyki gry ani szybkosci kulek.

const PROFILES = [
    { name: 'Poczatkujacy', thinkTicks: 16, vision: 700,  caution: 0.85, aggression: 0.65, huntRange: 450,  chaseTicks: 190, noProgressTicks: 110, restTicks: 230, splitChance: 0.00, splitCooldown: 380, aimError: 70 },
    { name: 'Sredni',       thinkTicks: 11, vision: 1000, caution: 1.00, aggression: 0.95, huntRange: 670,  chaseTicks: 260, noProgressTicks: 130, restTicks: 200, splitChance: 0.12, splitCooldown: 290, aimError: 35 },
    { name: 'Dobry',        thinkTicks: 7,  vision: 1300, caution: 1.25, aggression: 1.20, huntRange: 850,  chaseTicks: 340, noProgressTicks: 150, restTicks: 160, splitChance: 0.30, splitCooldown: 220, aimError: 15 },
    { name: 'Ekspert',      thinkTicks: 5,  vision: 1700, caution: 1.50, aggression: 1.45, huntRange: 1100, chaseTicks: 420, noProgressTicks: 180, restTicks: 130, splitChance: 0.55, splitCooldown: 160, aimError: 5 }
];

class BubbleXBotAI {
    constructor(server) {
        this.server = server;
        this.created = 0;
    }

    clampPoint(x, y, margin) {
        const border = this.server.border;
        if (!border) return { x, y };
        const minX = border.minx + margin;
        const maxX = border.maxx - margin;
        const minY = border.miny + margin;
        const maxY = border.maxy - margin;
        return {
            x: Math.max(Math.min(minX, maxX), Math.min(Math.max(minX, maxX), x)),
            y: Math.max(Math.min(minY, maxY), Math.min(Math.max(minY, maxY), y))
        };
    }

    // Losuje osiagalny cel, a nie punkt za krawedzia mapy.
    wanderPoint(cx, cy, radius = 750, margin = 110) {
        let goal = { x: cx, y: cy };
        for (let i = 0; i < 10; i++) {
            const a = Math.random() * Math.PI * 2;
            const distance = radius * (0.7 + Math.random() * 0.7);
            goal = this.clampPoint(cx + Math.cos(a) * distance, cy + Math.sin(a) * distance, margin);
            if (Math.hypot(goal.x - cx, goal.y - cy) > 300) return goal;
        }
        const border = this.server.border;
        return border ? this.clampPoint(
            (border.minx + border.maxx) / 2 + (Math.random() - 0.5) * radius,
            (border.miny + border.maxy) / 2 + (Math.random() - 0.5) * radius,
            margin
        ) : goal;
    }

    dropChase(brain, tick, restTicks) {
        if (brain.chaseId != null) {
            brain.avoidTargets.set(brain.chaseId, tick + restTicks);
        }
        brain.chaseId = null;
        brain.chaseSince = 0;
        brain.chaseProgressTick = 0;
        brain.bestDistance = Infinity;
    }

    update(bot) {
        if (!bot || !bot.cells || !bot.mouse || bot.isRemoved) return;
        const own = bot.cells.filter(c => c && !c.isRemoved && c.position && c.radius > 0);
        if (!own.length) {
            if (bot._bubbleXAI) {
                bot._bubbleXAI.chaseId = null;
                bot._bubbleXAI.lastAim = null;
                bot._bubbleXAI.sampleTick = null;
            }
            return; // Wbudowany system botow odpowiada za respawn.
        }

        if (!bot._bubbleXAI) {
            const number = this.created++;
            bot._bubbleXAI = {
                number,
                profile: PROFILES[Math.floor((number % 20) / 5)],
                nextThinkTick: 0,
                lastSplitTick: -10000,
                chaseId: null,
                chaseSince: 0,
                chaseProgressTick: 0,
                bestDistance: Infinity,
                avoidTargets: new Map(),
                wander: null,
                escapeUntil: 0,
                escapeAim: null,
                sampleTick: null,
                sampleX: 0,
                sampleY: 0,
                lastAim: null
            };
        }
        const brain = bot._bubbleXAI;
        const p = brain.profile;
        const tick = this.server.ticks;

        // Wbudowany BotPlayer.updateTick() moze zmienic pozycje myszy —
        // odnawiamy nasz ostatni cel po kazdej jego aktualizacji.
        if (tick < brain.nextThinkTick) {
            if (brain.lastAim) {
                bot.mouse.x = brain.lastAim.x;
                bot.mouse.y = brain.lastAim.y;
            }
            return;
        }
        brain.nextThinkTick = tick + p.thinkTicks;

        const largest = own.reduce((a, b) => a.radius >= b.radius ? a : b);
        const smallest = own.reduce((a, b) => a.radius <= b.radius ? a : b);
        let cx = 0, cy = 0, massSum = 0;
        for (const c of own) {
            const mass = c.radius * c.radius;
            cx += c.position.x * mass;
            cy += c.position.y * mass;
            massSum += mass;
        }
        if (massSum <= 0) return;
        cx /= massSum;
        cy /= massSum;
        const margin = Math.max(110, Math.min(350, largest.radius * 0.45));

        // Jezeli bot od dluzszego czasu probuje isc, ale prawie nie zmienia
        // pozycji, zmienia kierunek i odpoczywa od aktualnej pogoni.
        if (brain.sampleTick == null) {
            brain.sampleTick = tick;
            brain.sampleX = cx;
            brain.sampleY = cy;
        } else if (tick - brain.sampleTick >= 110) {
            const moved = Math.hypot(cx - brain.sampleX, cy - brain.sampleY);
            const hasDistantGoal = brain.lastAim &&
                Math.hypot(brain.lastAim.x - cx, brain.lastAim.y - cy) > 170;
            if (hasDistantGoal && moved < 14) {
                this.dropChase(brain, tick, p.restTicks);
                brain.wander = null;
                brain.escapeAim = this.wanderPoint(cx, cy, 900, margin);
                brain.escapeUntil = tick + 110;
            }
            brain.sampleTick = tick;
            brain.sampleX = cx;
            brain.sampleY = cy;
        }

        // Usuwaj przeterminowane blokady: zapobiega rozrostowi pamieci.
        if (tick % 1000 < p.thinkTicks) {
            for (const [id, until] of brain.avoidTargets) {
                if (until <= tick) brain.avoidTargets.delete(id);
            }
        }

        const maxCells = this.server.config.playerMaxCells || 16;
        const visionSq = p.vision * p.vision;
        let fleeX = 0, fleeY = 0, danger = 0;
        let bestPrey = null, bestPreyScore = -Infinity;
        let bestFood = null, bestFoodScore = -Infinity;

        for (const cell of this.server.nodesPlayer) {
            if (!cell || cell.isRemoved || !cell.position || !cell.owner || cell.owner === bot) continue;
            if (this.server.mode && this.server.mode.haveTeams && cell.owner.team === bot.team) continue;
            const dx = cell.position.x - cx;
            const dy = cell.position.y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 > visionSq) continue;
            const d = Math.max(1, Math.sqrt(d2));

            if (cell.radius > smallest.radius * 1.16) {
                const safe = (220 + cell.radius * 2 + largest.radius) * p.caution;
                if (d < safe) {
                    const strength = ((safe - d) / safe) * Math.min(3, cell.radius / smallest.radius);
                    fleeX -= dx / d * strength;
                    fleeY -= dy / d * strength;
                    danger += strength;
                }
            }

            // Cele do polowania: osiagnalne, wystarczajaco male i nie na cooldownie.
            if (d > p.huntRange || largest.radius < cell.radius * 1.28 ||
                (brain.avoidTargets.get(cell.id) || 0) > tick) continue;
            let score = (20 + cell.radius * 0.07) * p.aggression - d * 0.025;
            // Nie zmieniaj celu co chwile podczas poprawnie przebiegajacej gonitwy.
            if (brain.chaseId === cell.id) score += 5;
            if (score > bestPreyScore) {
                bestPreyScore = score;
                bestPrey = { cell, d };
            }
        }

        // Oddal sie od min, jesli groza dodatkowym rozdzieleniem.
        if (own.length < maxCells) {
            for (const v of this.server.nodesVirus) {
                if (!v || v.isRemoved || !v.position || largest.radius < v.radius * 1.17) continue;
                const dx = v.position.x - cx;
                const dy = v.position.y - cy;
                const d = Math.max(1, Math.hypot(dx, dy));
                const safe = (largest.radius + v.radius + 100) * p.caution;
                if (d >= safe) continue;
                const strength = (safe - d) / safe * 1.2;
                fleeX -= dx / d * strength;
                fleeY -= dy / d * strength;
                danger += strength;
            }
        }

        for (const foods of [this.server.nodesFood, this.server.nodesEjected]) {
            for (const food of foods) {
                if (!food || food.isRemoved || !food.position) continue;
                const dx = food.position.x - cx;
                const dy = food.position.y - cy;
                const d2 = dx * dx + dy * dy;
                if (d2 > visionSq) continue;
                const d = Math.sqrt(d2);
                const score = 17 + Math.min(40, food.radius) * 0.1 - d * 0.022;
                if (score > bestFoodScore) {
                    bestFoodScore = score;
                    bestFood = { cell: food, dx, dy, d };
                }
            }
        }

        let aim;
        if (danger > 0.4) {
            this.dropChase(brain, tick, p.restTicks);
            const length = Math.hypot(fleeX, fleeY);
            if (length > 0.001) {
                aim = { x: cx + fleeX / length * 1100, y: cy + fleeY / length * 1100 };
            } else {
                aim = this.wanderPoint(cx, cy, 800, margin);
            }
        } else if (brain.escapeUntil > tick && brain.escapeAim) {
            aim = brain.escapeAim;
        } else {
            if (brain.escapeUntil && brain.escapeUntil <= tick) {
                brain.escapeUntil = 0;
                brain.escapeAim = null;
            }

            if (bestPrey && (bestPreyScore > bestFoodScore + 2 || !bestFood)) {
                const prey = bestPrey.cell;
                if (brain.chaseId !== prey.id) {
                    this.dropChase(brain, tick, p.restTicks);
                    brain.chaseId = prey.id;
                    brain.chaseSince = tick;
                    brain.chaseProgressTick = tick;
                    brain.bestDistance = bestPrey.d;
                }
                if (bestPrey.d < brain.bestDistance - 25) {
                    brain.bestDistance = bestPrey.d;
                    brain.chaseProgressTick = tick;
                }
                if (tick - brain.chaseSince >= p.chaseTicks ||
                    tick - brain.chaseProgressTick >= p.noProgressTicks) {
                    // Ofiara stale ucieka lub poscig trwa za dlugo.
                    this.dropChase(brain, tick, p.restTicks);
                    bestPrey = null;
                } else {
                    const dx = prey.position.x - cx;
                    const dy = prey.position.y - cy;
                    const d = Math.max(1, Math.hypot(dx, dy));
                    // Cel za ofiara, zeby bot nie stal w miejscu tuz przed nia.
                    const reach = Math.max(400, d + 180);
                    aim = { x: cx + dx / d * reach, y: cy + dy / d * reach };
                    const canSplit = own.length < maxCells &&
                        largest.radius >= this.server.config.playerMinSplitSize &&
                        largest.radius > prey.radius * 1.9 &&
                        d > largest.radius * 0.85 && d < 290 + largest.radius * 1.1 &&
                        tick - brain.lastSplitTick >= p.splitCooldown &&
                        Math.random() < p.splitChance;
                    if (canSplit) {
                        bot.mouse.x = prey.position.x;
                        bot.mouse.y = prey.position.y;
                        this.server.splitCells(bot);
                        brain.lastSplitTick = tick;
                    }
                }
            } else if (brain.chaseId != null) {
                this.dropChase(brain, tick, p.restTicks);
            }

            if (!aim && bestFood) {
                const d = Math.max(1, bestFood.d);
                // Lec przez jedzenie, a nie zatrzymuj sie DOKLADNIE na nim.
                const dx = d > 1 ? bestFood.dx / d : Math.cos(tick);
                const dy = d > 1 ? bestFood.dy / d : Math.sin(tick);
                const travel = Math.max(420, d + 140);
                aim = { x: cx + dx * travel, y: cy + dy * travel };
            }
            if (!aim) {
                // Gdy w zasiegu nie ma jedzenia ani dobrych celow, zwiedzaj mape.
                if (!brain.wander || tick >= brain.wander.until ||
                    Math.hypot(brain.wander.x - cx, brain.wander.y - cy) < 120) {
                    const point = this.wanderPoint(cx, cy, 800, margin);
                    brain.wander = { x: point.x, y: point.y, until: tick + 220 + Math.random() * 250 };
                }
                aim = brain.wander;
            }
        }

        if (p.aimError > 0 && danger <= 0.4 && brain.chaseId != null) {
            aim.x += (Math.random() - 0.5) * p.aimError;
            aim.y += (Math.random() - 0.5) * p.aimError;
        }

        aim = this.clampPoint(aim.x, aim.y, margin);
        // Osobny bezpiecznik na deadlock: cel zbyt bliski aktualnej pozycji.
        if (Math.hypot(aim.x - cx, aim.y - cy) < 110) {
            aim = this.wanderPoint(cx, cy, 800, margin);
            brain.wander = { ...aim, until: tick + 200 };
        }
        if (Number.isFinite(aim.x) && Number.isFinite(aim.y)) {
            bot.mouse.x = aim.x;
            bot.mouse.y = aim.y;
            brain.lastAim = { x: aim.x, y: aim.y };
        }
    }
}

module.exports = BubbleXBotAI;
