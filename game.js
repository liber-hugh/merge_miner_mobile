document.addEventListener('DOMContentLoaded', () => {
    const { Engine, Render, Runner, World, Bodies, Body, Events, Composite } = Matter;

    const MINERALS = [
        { level: 1, name: '흙덩이', score: 1, texture: 'resources/1. 흙덩이 small_round_dirt_game_asset_index transparent.png' },
        { level: 2, name: '조약돌', score: 3, texture: 'resources/2. 조약돌-pebble_stone_index_transparent@1024x1024.png' },
        { level: 3, name: '석탄', score: 6, texture: 'resources/3. 석탄-coal_index_transparent@1024x1024.png' },
        { level: 4, name: '철광석', score: 10, texture: 'resources/4. 철광석-iron_ore_chunk_tier_four_index_transparent@1024x1024.png' },
        { level: 5, name: '구리 원석', score: 15, texture: 'resources/5. 구리 원석-round_copper_ore_transparent@1024x1024.png' },
        { level: 6, name: '은괴', score: 21, texture: 'resources/6. 은괴-round_silver_transparent@1024x1024.png' },
        { level: 7, name: '금괴', score: 28, texture: 'resources/7. 금괴-round_gold_transparent@1024x1024.png.png' },
        { level: 8, name: '자수정', score: 36, texture: 'resources/8. 자수정-amethyst_transparent@1024x1024.png.png' },
        { level: 9, name: '에메랄드', score: 45, texture: 'resources/9. 에메랄드-emerald_transparent@1024x1024.png' },
        { level: 10, name: '루비', score: 55, texture: 'resources/10. 루비-ruby_transparent@1024x1024.png' },
        { level: 11, name: '다이아몬드', score: 66, texture: 'resources/11. 거대 다이아몬드-ultimate_diamond_transparent@1024x1024.png' },
    ];

    const GAME_CONFIG = {
        radii: [0.058, 0.074, 0.093, 0.114, 0.137, 0.161, 0.188, 0.216, 0.245, 0.277, 0.315], // 70%로 축소
        world: { width: 600, height: 1500, gravity: 1.0 }, // 더 사실적인 중력
        drop: { initialMaxLevel: 5, cooldown: 150 }, // 드롭 레벨 5로 확장
        gameOver: { lineY: 280, checkDelay: 500 } // 광석레벨 버튼 아래로 더 이동
    };

    const dom = {
        gameContainer: document.getElementById('game-container'),
        dropZone: document.getElementById('drop-zone'),
        score: document.getElementById('score'),
        nextMineralContainer: document.getElementById('next-mineral-image-container'),
        gameOverModal: document.getElementById('game-over-modal'),
        finalScore: document.getElementById('final-score'),
        restartButton: document.getElementById('restart-button'),
        stoneDropSfx: document.getElementById('stone-drop-sfx'),
        merge1Sfx: document.getElementById('merge1-sfx'),
        merge2Sfx: document.getElementById('merge2-sfx'),
        gameOverSfx: document.getElementById('game-over-sfx'),
        backgroundMusic: document.getElementById('background-music'),
        mineralGuideToggle: document.getElementById('mineral-guide-toggle'),
        mineralGuidePanel: document.getElementById('mineral-guide-panel'),
        mineralList: document.getElementById('mineral-list'),
        // 스킬 버튼들
        bombSkill: document.getElementById('bomb-skill'),
        collapseSkill: document.getElementById('collapse-skill'),
        hammerSkill: document.getElementById('hammer-skill'),
        bombCount: document.getElementById('bomb-count'),
        collapseCount: document.getElementById('collapse-count'),
        hammerCount: document.getElementById('hammer-count')
    };

    let engine, render, runner, currentMineral, nextMineral, score, canDrop, isGameOver, gameOverTimeout;
    
    // 스킬 시스템 변수들
    let skillCounts = {
        bomb: 3,
        collapse: 3,
        hammer: 1
    };
    let activeSkill = null; // 'bomb', 'hammer', null
    let bombs = []; // 설치된 폭약들

    function init() {
        engine = Engine.create();
        engine.world.gravity.y = GAME_CONFIG.world.gravity;
        
        setupRenderer();
        setupWorld();

        runner = Runner.create();
        Runner.run(runner, engine);
        
        setupEventListeners();
        setupMineralGuide();
        setupBackgroundMusic();
        
        startGame();
        
        window.addEventListener('resize', handleResize);
        handleResize();
    }

    function setupRenderer() {
        render = Render.create({
            element: dom.gameContainer,
            engine: engine,
            options: {
                width: dom.gameContainer.clientWidth,
                height: dom.gameContainer.clientHeight,
                wireframes: false,
                background: 'transparent',
                pixelRatio: 'auto'
            }
        });
        Render.run(render);
    }
    
    function setupWorld() {
        const { width, height } = GAME_CONFIG.world;
        const wallThickness = 25; // 테두리 두께에 맞춰 벽 두께 조정
        World.add(engine.world, [
            Bodies.rectangle(width / 2, height, width, wallThickness, { isStatic: true, render: { visible: false } }), // Floor
            Bodies.rectangle(-wallThickness/2, height / 2, wallThickness, height, { isStatic: true, render: { visible: false } }), // Left wall
            Bodies.rectangle(width + wallThickness/2, height / 2, wallThickness, height, { isStatic: true, render: { visible: false } }) // Right wall
        ]);
    }
    
    function setupEventListeners() {
        // 마우스 이벤트
        dom.dropZone.addEventListener('mousemove', handlePointerMove);
        dom.dropZone.addEventListener('click', handleGameAreaClick);
        
        // 터치 이벤트 (모바일 최적화)
        dom.dropZone.addEventListener('touchstart', handleTouchStart, { passive: false });
        dom.dropZone.addEventListener('touchmove', handleTouchMove, { passive: false });
        dom.dropZone.addEventListener('touchend', handleTouchEnd, { passive: false });
        
        // 컨텍스트 메뉴 방지 (모바일에서 길게 누르기 방지)
        dom.dropZone.addEventListener('contextmenu', e => e.preventDefault());
        
        // 드래그 방지
        dom.dropZone.addEventListener('dragstart', e => e.preventDefault());
        
        dom.restartButton.addEventListener('click', restartGame);
        dom.mineralGuideToggle.addEventListener('click', toggleMineralGuide);
        
        // 스킬 버튼 이벤트 리스너
    dom.bombSkill.addEventListener('click', activateBombSkill);
    dom.collapseSkill.addEventListener('click', activateCollapseSkill);
    dom.hammerSkill.addEventListener('click', activateHammerSkill);
    
    // 도움말 버튼 이벤트 리스너
    const bombHelp = document.getElementById('bomb-help');
    const collapseHelp = document.getElementById('collapse-help');
    const hammerHelp = document.getElementById('hammer-help');
    
    if (bombHelp) {
        bombHelp.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('Bomb help clicked');
            toggleTooltip('bomb-tooltip');
        });
    }
    
    if (collapseHelp) {
        collapseHelp.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('Collapse help clicked');
            toggleTooltip('collapse-tooltip');
        });
    }
    
    if (hammerHelp) {
        hammerHelp.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('Hammer help clicked');
            toggleTooltip('hammer-tooltip');
        });
    }

        Events.on(engine, 'collisionStart', handleCollision);
        Events.on(engine, 'beforeUpdate', checkGameOverCondition);
    }

    function startGame() {
        isGameOver = false;
        canDrop = true;
        score = 0;
        updateScore(0);
        
        // 스킬 카운트 초기화
        skillCounts = { bomb: 3, collapse: 3, hammer: 1 };
        activeSkill = null;
        bombs = [];
        updateSkillUI();
        resetGameAreaMode();
        
        dom.gameOverModal.classList.add('hidden');
        dom.gameOverModal.classList.remove('flex');
        
        nextMineral = generateRandomMineral();
        prepareNextMineral();
    }

    function restartGame() {
        World.clear(engine.world, false);
        setupWorld();
        startGame();
    }
    
    function createMineral(level, x, y) {
        const mineralData = MINERALS[level - 1];
        const radius = GAME_CONFIG.radii[level - 1] * GAME_CONFIG.world.width;
        
        // 광물별 사실적인 물리 속성
        const physicsProperties = {
            // 흙덩이, 조약돌 - 부드러운 재질
            1: { restitution: 0.2, friction: 0.8, frictionStatic: 1.0, density: 1.5 },
            2: { restitution: 0.3, friction: 0.7, frictionStatic: 0.9, density: 2.0 },
            // 석탄 - 약간 단단함
            3: { restitution: 0.25, friction: 0.6, frictionStatic: 0.8, density: 1.3 },
            // 철광석 - 단단하고 무거움
            4: { restitution: 0.4, friction: 0.5, frictionStatic: 0.7, density: 7.8 },
            // 구리 원석 - 금속성
            5: { restitution: 0.35, friction: 0.4, frictionStatic: 0.6, density: 8.9 },
            // 은괴 - 무거운 금속
            6: { restitution: 0.3, friction: 0.3, frictionStatic: 0.5, density: 10.5 },
            // 금괴 - 매우 무거운 금속
            7: { restitution: 0.25, friction: 0.25, frictionStatic: 0.4, density: 19.3 },
            // 자수정 - 단단한 보석
            8: { restitution: 0.5, friction: 0.2, frictionStatic: 0.3, density: 2.6 },
            // 에메랄드 - 단단한 보석
            9: { restitution: 0.45, friction: 0.2, frictionStatic: 0.3, density: 2.7 },
            // 루비 - 매우 단단한 보석
            10: { restitution: 0.4, friction: 0.15, frictionStatic: 0.25, density: 4.0 },
            // 거대 다이아몬드 - 가장 단단함
            11: { restitution: 0.6, friction: 0.1, frictionStatic: 0.2, density: 3.5 }
        };
        
        const props = physicsProperties[level] || physicsProperties[1];
        
        const body = Bodies.circle(x, y, radius, {
            label: `mineral-${level}`,
            restitution: props.restitution,
            friction: props.friction,
            frictionStatic: props.frictionStatic,
            frictionAir: 0.01, // 공기 저항 감소
            density: props.density * 0.001, // 밀도 스케일링
            render: {
                sprite: {
                    texture: mineralData.texture,
                    xScale: (radius * 2.8) / 1024,
                    yScale: (radius * 2.8) / 1024
                }
            }
        });

        setTimeout(() => {
            if (Composite.get(engine.world, body.id, 'body')) {
                body.isSleeping = false;
            }
        }, 1500);

        return body;
    }

    function generateRandomMineral() {
        const rand = Math.random();
        
        // 1-3단계: 70% 확률 (각각 23.33%)
        if (rand < 0.7) {
            return Math.floor(rand / 0.7 * 3) + 1;
        }
        // 4단계: 20% 확률
        else if (rand < 0.9) {
            return 4;
        }
        // 5단계: 10% 확률
        else {
            return 5;
        }
    }

    function prepareNextMineral() {
        currentMineral = createMineral(nextMineral, -1000, -1000); // Create off-screen
        currentMineral.isStatic = true;

        nextMineral = generateRandomMineral();
        const nextMineralData = MINERALS[nextMineral - 1];
        dom.nextMineralContainer.innerHTML = `<img src=\"${nextMineralData.texture}\" alt=\"${nextMineralData.name}\" class=\"w-full h-full object-contain\">`;
    }
    
    function handlePointerMove(e) {
        if (!currentMineral || isGameOver) return;
        const bounds = dom.dropZone.getBoundingClientRect();
        const x = (e.clientX - bounds.left) / bounds.width * GAME_CONFIG.world.width;
        
        const radius = GAME_CONFIG.radii[currentMineral.label.split('-')[1] - 1] * GAME_CONFIG.world.width;
        // 벽 두께를 고려하여 경계 계산 수정 (벽 두께 25를 반영)
        const wallThickness = 25;
        const clampedX = Math.max(radius + wallThickness/2, Math.min(x, GAME_CONFIG.world.width - radius - wallThickness/2));
        
        Body.setPosition(currentMineral, { x: clampedX, y: 50 });

        if (!Composite.get(engine.world, currentMineral.id, 'body')) {
            World.add(engine.world, currentMineral);
        }
    }
    
    // 터치 이벤트 핸들러들 (모바일 최적화)
    let lastTouchX = null;
    let touchStartTime = 0;
    
    function handleTouchStart(e) {
        e.preventDefault();
        touchStartTime = Date.now();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            lastTouchX = touch.clientX;
            handlePointerMove(touch);
        }
    }
    
    function handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            lastTouchX = touch.clientX;
            handlePointerMove(touch);
        }
    }
    
    function handleTouchEnd(e) {
        e.preventDefault();
        const touchDuration = Date.now() - touchStartTime;
        
        // 짧은 터치만 클릭으로 인식 (500ms 이하)
        if (touchDuration < 500 && lastTouchX !== null) {
            const bounds = dom.dropZone.getBoundingClientRect();
            const x = (lastTouchX - bounds.left) / bounds.width * GAME_CONFIG.world.width;
            const y = 50; // 기본 드롭 위치
            
            handleGameAreaClickInternal(x, y);
        }
        
        lastTouchX = null;
        touchStartTime = 0;
    }

    function handleGameAreaClick(e) {
        if (isGameOver) return;
        
        const bounds = dom.dropZone.getBoundingClientRect();
        const x = (e.clientX - bounds.left) / bounds.width * GAME_CONFIG.world.width;
        const y = (e.clientY - bounds.top) / bounds.height * GAME_CONFIG.world.height;
        
        handleGameAreaClickInternal(x, y);
    }
    
    function handleGameAreaClickInternal(x, y) {
        if (isGameOver) return;
        
        if (activeSkill === 'bomb') {
            placeBomb(x, y);
        } else if (activeSkill === 'hammer') {
            selectMineralForUpgrade(x, y);
        } else {
            handleDrop();
        }
    }
    
    function handleDrop() {
        if (!canDrop || isGameOver || !currentMineral) return;
        
        canDrop = false;
        
        // 돌 떨어지는 소리 재생
        if (dom.stoneDropSfx) {
            dom.stoneDropSfx.volume = 0.15; // 볼륨을 더 작게 (15%로 설정)
            dom.stoneDropSfx.currentTime = 0;
            dom.stoneDropSfx.play().catch(e => console.error("Stone drop SFX play failed:", e));
        }
        
        // 초기 속도를 0으로 설정하여 튕기는 현상 방지
        Body.setVelocity(currentMineral, { x: 0, y: 0 });
        Body.setAngularVelocity(currentMineral, 0);
        
        Body.setStatic(currentMineral, false);
        currentMineral.isSleeping = false;
        
        currentMineral = null;
        
        setTimeout(() => {
            if (!isGameOver) {
                prepareNextMineral();
                canDrop = true;
            }
        }, GAME_CONFIG.drop.cooldown);
    }
    
    function handleCollision(event) {
        if (isGameOver) return;

        event.pairs.forEach(pair => {
            const { bodyA, bodyB } = pair;
            
            if (bodyA.isStatic || bodyB.isStatic) return;

            if (bodyA.label.startsWith('mineral-') && bodyA.label === bodyB.label) {
                const level = parseInt(bodyA.label.split('-')[1]);
                if (level >= MINERALS.length) return;

                const newLevel = level + 1;
                const newX = (bodyA.position.x + bodyB.position.x) / 2;
                const newY = (bodyA.position.y + bodyB.position.y) / 2;
                
                World.remove(engine.world, [bodyA, bodyB]);

                const newMineral = createMineral(newLevel, newX, newY);
                World.add(engine.world, newMineral);
                
                playMergeEffect(newX, newY, level);
                updateScore(MINERALS[newLevel - 1].score);
            }
        });
    }

    function playMergeEffect(x, y, level) {
        // 광석 레벨에 따라 다른 머지 소리 재생
        if (level >= 1 && level <= 6) {
            // 1-6단계: merge1 소리
            if (dom.merge1Sfx) {
                dom.merge1Sfx.currentTime = 0;
                dom.merge1Sfx.play().catch(e => console.error("Merge1 SFX play failed:", e));
            }
        } else if (level >= 7 && level <= 11) {
            // 7-11단계: merge2 소리
            if (dom.merge2Sfx) {
                dom.merge2Sfx.currentTime = 0;
                dom.merge2Sfx.play().catch(e => console.error("Merge2 SFX play failed:", e));
            }
        }
        
        createMergeParticles(x, y);
    }

    function createMergeParticles(x, y) {
        const particleCount = 8;
        const particleRadius = 3;
        const particleColor = '#ffd700';

        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const speed = Math.random() * 3 + 2;

            const particle = Bodies.circle(x, y, particleRadius, {
                label: 'particle',
                render: { fillStyle: particleColor },
                restitution: 0.8,
                frictionAir: 0.05,
                isSensor: true,
            });

            Body.setVelocity(particle, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
            World.add(engine.world, particle);

            setTimeout(() => {
                if (Composite.get(engine.world, particle.id, 'body')) {
                    World.remove(engine.world, particle);
                }
            }, 600);
        }
    }

    function checkGameOverCondition() {
        if (isGameOver) return;
        const bodies = Composite.allBodies(engine.world);
        let highestBody = null;
        
        for (const body of bodies) {
            if (!body.isStatic && body.label !== 'particle' && body.position.y < GAME_CONFIG.gameOver.lineY + (body.circleRadius || 0)) {
                 if (body.speed < 0.1 && body.angularSpeed < 0.1) {
                     if (!highestBody || body.position.y < highestBody.position.y) {
                         highestBody = body;
                     }
                 }
            }
        }

        if (highestBody) {
            if (!gameOverTimeout) {
                gameOverTimeout = setTimeout(triggerGameOver, GAME_CONFIG.gameOver.checkDelay);
            }
        } else {
            clearTimeout(gameOverTimeout);
            gameOverTimeout = null;
        }
    }

    function triggerGameOver() {
        if(isGameOver) return;
        isGameOver = true;
        canDrop = false;

        // 게임 오버 소리 재생
        if (dom.gameOverSfx) {
            dom.gameOverSfx.currentTime = 0;
            dom.gameOverSfx.play().catch(e => console.error("Game over SFX play failed:", e));
        }

        if (currentMineral) {
            World.remove(engine.world, currentMineral);
            currentMineral = null;
        }

        dom.finalScore.textContent = score;
        dom.gameOverModal.classList.remove('hidden');
        dom.gameOverModal.classList.add('flex');
    }

    function updateScore(points) {
        score += points;
        dom.score.textContent = score;
    }

    function handleResize() {
        // 모바일에서 키보드가 나타날 때 레이아웃 조정
        const containerWidth = dom.gameContainer.clientWidth;
        const containerHeight = dom.gameContainer.clientHeight;
        
        // 모바일 환경에서 뷰포트 높이 조정
        if (window.innerWidth <= 768) {
            // 모바일에서는 실제 뷰포트 높이 사용
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
            
            // 게임 래퍼 높이 조정
            const gameWrapper = document.getElementById('game-wrapper');
            if (gameWrapper) {
                gameWrapper.style.height = `${window.innerHeight}px`;
            }
        }
        
        render.options.width = containerWidth;
        render.options.height = containerHeight;
        render.canvas.width = containerWidth;
        render.canvas.height = containerHeight;
        
        // 고해상도 디스플레이 지원
        const pixelRatio = window.devicePixelRatio || 1;
        render.canvas.style.width = containerWidth + 'px';
        render.canvas.style.height = containerHeight + 'px';
        render.canvas.width = containerWidth * pixelRatio;
        render.canvas.height = containerHeight * pixelRatio;
        render.context.scale(pixelRatio, pixelRatio);
        
        Render.lookAt(render, {
            min: { x: 0, y: 0 },
            max: { x: GAME_CONFIG.world.width, y: GAME_CONFIG.world.height }
        });
    }

    function setupMineralGuide() {
        // 광석 목록 생성
        MINERALS.forEach((mineral, index) => {
            const mineralItem = document.createElement('div');
            mineralItem.className = 'flex items-center space-x-2 p-2 bg-stone-700/50 rounded border border-stone-600';
            
            mineralItem.innerHTML = `
                <div class="w-8 h-8 flex-shrink-0">
                    <img src="${mineral.texture}" alt="${mineral.name}" class="w-full h-full object-contain">
                </div>
                <div class="flex-1">
                    <div class="text-xs font-rye text-amber-200">Lv.${mineral.level}</div>
                    <div class="text-xs text-white">${mineral.name}</div>
                    <div class="text-xs text-gray-300">${mineral.score}점</div>
                </div>
            `;
            
            dom.mineralList.appendChild(mineralItem);
        });
    }

    function toggleMineralGuide() {
        const isHidden = dom.mineralGuidePanel.classList.contains('hidden');
        
        if (isHidden) {
            dom.mineralGuidePanel.classList.remove('hidden');
            dom.mineralGuidePanel.classList.add('block');
        } else {
            dom.mineralGuidePanel.classList.add('hidden');
            dom.mineralGuidePanel.classList.remove('block');
        }
    }

    function setupBackgroundMusic() {
        if (dom.backgroundMusic) {
            // 배경음악 볼륨을 낮게 설정 (0.3 = 30%)
            dom.backgroundMusic.volume = 0.3;
            
            // 사용자 상호작용 후 배경음악 재생
            const startBackgroundMusic = () => {
                dom.backgroundMusic.play().catch(e => {
                    console.log("Background music autoplay prevented:", e);
                });
                // 이벤트 리스너 제거 (한 번만 실행)
                document.removeEventListener('click', startBackgroundMusic);
                document.removeEventListener('touchstart', startBackgroundMusic);
            };
            
            // 첫 번째 클릭/터치 시 배경음악 시작
            document.addEventListener('click', startBackgroundMusic);
            document.addEventListener('touchstart', startBackgroundMusic);
        }
    }
    
    // 스킬 시스템 함수들
    function activateBombSkill() {
        if (skillCounts.bomb <= 0 || isGameOver) return;
        
        if (activeSkill === 'bomb') {
            // 이미 활성화된 경우 취소
            activeSkill = null;
            resetGameAreaMode();
        } else {
            activeSkill = 'bomb';
            dom.dropZone.classList.add('bomb-mode');
            dom.dropZone.classList.remove('hammer-mode');
        }
    }
    
    function activateCollapseSkill() {
        if (skillCounts.collapse <= 0 || isGameOver) return;
        
        skillCounts.collapse--;
        updateSkillUI();
        
        // 맨 위에서부터 낮은 레벨(1-4단계) 광석들 파괴
        const bodies = Composite.allBodies(engine.world);
        const mineralsToDestroy = [];
        
        bodies.forEach(body => {
            if (body.label.startsWith('mineral-')) {
                const level = parseInt(body.label.split('-')[1]);
                if (level >= 1 && level <= 4) {
                    mineralsToDestroy.push(body);
                }
            }
        });
        
        // Y 좌표 기준으로 정렬 (위쪽부터)
        mineralsToDestroy.sort((a, b) => a.position.y - b.position.y);
        
        // 상위 몇 개만 파괴 (너무 많이 파괴되지 않도록)
        const destroyCount = Math.min(mineralsToDestroy.length, 8);
        for (let i = 0; i < destroyCount; i++) {
            World.remove(engine.world, mineralsToDestroy[i]);
            createMergeParticles(mineralsToDestroy[i].position.x, mineralsToDestroy[i].position.y);
        }
    }
    
    function activateHammerSkill() {
        if (skillCounts.hammer <= 0 || isGameOver) return;
        
        if (activeSkill === 'hammer') {
            // 이미 활성화된 경우 취소
            activeSkill = null;
            resetGameAreaMode();
        } else {
            activeSkill = 'hammer';
            dom.dropZone.classList.add('hammer-mode');
            dom.dropZone.classList.remove('bomb-mode');
        }
    }
    
    function placeBomb(x, y) {
        if (skillCounts.bomb <= 0) return;
        
        skillCounts.bomb--;
        activeSkill = null;
        resetGameAreaMode();
        updateSkillUI();
        
        // 폭약 시각적 표시 생성
        const bombElement = document.createElement('div');
        bombElement.style.position = 'absolute';
        bombElement.style.left = (x / GAME_CONFIG.world.width * 100) + '%';
        bombElement.style.top = (y / GAME_CONFIG.world.height * 100) + '%';
        bombElement.style.width = '30px';
        bombElement.style.height = '30px';
        bombElement.style.transform = 'translate(-50%, -50%)';
        bombElement.style.fontSize = '24px';
        bombElement.style.zIndex = '10';
        bombElement.textContent = '💣';
        bombElement.style.pointerEvents = 'none';
        
        dom.gameContainer.appendChild(bombElement);
        
        // 3초 후 폭발
        setTimeout(() => {
            explodeBomb(x, y, bombElement);
        }, 3000);
    }
    
    function explodeBomb(x, y, bombElement) {
        // 폭약 제거
        if (bombElement && bombElement.parentNode) {
            bombElement.parentNode.removeChild(bombElement);
        }
        
        // 폭발 효과 생성
        const explosionElement = document.createElement('div');
        explosionElement.className = 'bomb-explosion';
        explosionElement.style.left = (x / GAME_CONFIG.world.width * 100) + '%';
        explosionElement.style.top = (y / GAME_CONFIG.world.height * 100) + '%';
        explosionElement.style.width = '200px';
        explosionElement.style.height = '200px';
        explosionElement.style.transform = 'translate(-50%, -50%)';
        
        dom.gameContainer.appendChild(explosionElement);
        
        // 폭발 범위 내 광석들 제거
        const explosionRadius = 100;
        const bodies = Composite.allBodies(engine.world);
        
        bodies.forEach(body => {
            if (body.label.startsWith('mineral-')) {
                const distance = Math.sqrt(
                    Math.pow(body.position.x - x, 2) + Math.pow(body.position.y - y, 2)
                );
                
                if (distance <= explosionRadius) {
                    World.remove(engine.world, body);
                    createMergeParticles(body.position.x, body.position.y);
                }
            }
        });
        
        // 폭발 효과 제거
        setTimeout(() => {
            if (explosionElement && explosionElement.parentNode) {
                explosionElement.parentNode.removeChild(explosionElement);
            }
        }, 500);
    }
    
    function selectMineralForUpgrade(x, y) {
        if (skillCounts.hammer <= 0) return;
        
        const bodies = Composite.allBodies(engine.world);
        let selectedMineral = null;
        let minDistance = Infinity;
        
        // 클릭 위치에서 가장 가까운 광석 찾기
        bodies.forEach(body => {
            if (body.label.startsWith('mineral-')) {
                const distance = Math.sqrt(
                    Math.pow(body.position.x - x, 2) + Math.pow(body.position.y - y, 2)
                );
                
                const radius = body.circleRadius || 30;
                if (distance <= radius && distance < minDistance) {
                    selectedMineral = body;
                    minDistance = distance;
                }
            }
        });
        
        if (selectedMineral) {
            const currentLevel = parseInt(selectedMineral.label.split('-')[1]);
            if (currentLevel < MINERALS.length) {
                skillCounts.hammer--;
                activeSkill = null;
                resetGameAreaMode();
                updateSkillUI();
                
                // 광석 업그레이드
                const newLevel = currentLevel + 1;
                const newMineral = createMineral(newLevel, selectedMineral.position.x, selectedMineral.position.y);
                
                World.remove(engine.world, selectedMineral);
                World.add(engine.world, newMineral);
                
                createMergeParticles(selectedMineral.position.x, selectedMineral.position.y);
                updateScore(MINERALS[newLevel - 1].score - MINERALS[currentLevel - 1].score);
            }
        }
    }
    
    function updateSkillUI() {
        dom.bombCount.textContent = `${skillCounts.bomb}`;
        dom.collapseCount.textContent = `${skillCounts.collapse}`;
        dom.hammerCount.textContent = `${skillCounts.hammer}`;
        
        // 버튼 비활성화 상태 업데이트
        dom.bombSkill.disabled = skillCounts.bomb <= 0;
        dom.collapseSkill.disabled = skillCounts.collapse <= 0;
        dom.hammerSkill.disabled = skillCounts.hammer <= 0;
    }
    
    function resetGameAreaMode() {
        dom.dropZone.classList.remove('bomb-mode', 'hammer-mode');
    }

    // 툴팁 토글 함수
    function toggleTooltip(tooltipId) {
        console.log('toggleTooltip called with:', tooltipId);
        const tooltip = document.getElementById(tooltipId);
        
        if (!tooltip) {
            console.error('Tooltip not found:', tooltipId);
            return;
        }
        
        const allTooltips = document.querySelectorAll('[id$="-tooltip"]');
        console.log('Found tooltips:', allTooltips.length);
        
        // 다른 모든 툴팁 숨기기
        allTooltips.forEach(tip => {
            if (tip.id !== tooltipId) {
                tip.classList.add('hidden');
            }
        });
        
        // 현재 툴팁 토글
        const wasHidden = tooltip.classList.contains('hidden');
        tooltip.classList.toggle('hidden');
        console.log('Tooltip', tooltipId, wasHidden ? 'shown' : 'hidden');
    }

    init();
});
