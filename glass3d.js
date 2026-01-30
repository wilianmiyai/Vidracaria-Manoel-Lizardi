/**
 * Vidraçaria Manoel Lizardi - Showcase 3D de Vidros ULTRA COMPLETO
 * Recursos: Luz dinâmica, Rachadura, Bola de impacto, Sparkles, Espessura, Dia/Noite, Chuva, Marcas de dedo
 */

(function() {
    'use strict';

    if (typeof THREE === 'undefined') {
        console.warn('Three.js não carregado.');
        return;
    }

    // Configurações dos tipos de vidro (valores base, reduzidos no mobile)
    const CONFIG = {
        container: 'glass3d-canvas',
        glassTypes: {
            temperado: {
                title: 'Vidro Temperado',
                desc: 'Vidro de segurança 5x mais resistente. Quebra em PEQUENOS CUBOS não cortantes - seguro para box, portas e fachadas.',
                color: 0x88CCDD, opacity: 0.35, roughness: 0.05, thickness: 8,
                tint: 0x66AACC,
                fragments: 250, fragmentType: 'cube',
                fragmentSize: { min: 0.03, max: 0.07 },
                spreadRadius: 1.5, safety: 95, sound: 'shatter-small',
                // Mensagens didáticas
                breakMessage: 'Fragmentos pequenos e arredondados!',
                breakDetail: 'Não cortam - seguros para áreas com crianças',
                safetyIcon: '✅',
                safetyLabel: 'SEGURO'
            },
            laminado: {
                title: 'Vidro Laminado',
                desc: 'Película PVB entre camadas. Fragmentos FICAM UNIDOS mesmo quebrado - máxima segurança para guarda-corpos.',
                color: 0x88DD99, opacity: 0.4, roughness: 0.08, thickness: 10,
                tint: 0x66BB77,
                fragments: 60, fragmentType: 'crack',
                fragmentSize: { min: 0.12, max: 0.3 },
                spreadRadius: 0.5, safety: 100, sound: 'crack', staysOnFilm: true,
                breakMessage: 'Fragmentos presos na película!',
                breakDetail: 'Não caem - ideal para guarda-corpos e sacadas',
                safetyIcon: '✅✅',
                safetyLabel: 'MUITO SEGURO'
            },
            fantasia: {
                title: 'Vidro Fantasia',
                desc: 'Vidros decorativos texturizados (Martelado, Canelado, Ártico). Quebra em PEDAÇOS IRREGULARES médios.',
                color: 0xDDDDEE, opacity: 0.7, roughness: 0.5, thickness: 4,
                tint: 0xCCCCDD,
                fragments: 120, fragmentType: 'irregular',
                fragmentSize: { min: 0.08, max: 0.2 },
                spreadRadius: 1.2, safety: 60, sound: 'shatter-medium',
                breakMessage: 'Pedaços irregulares médios',
                breakDetail: 'Podem cortar - manusear com cuidado',
                safetyIcon: '⚠️',
                safetyLabel: 'CUIDADO'
            },
            espelho: {
                title: 'Espelho',
                desc: 'Espelhos com acabamentos especiais. Quebra em PONTAS AFIADAS reflexivas - cuidado ao manusear!',
                color: 0xBBCCDD, opacity: 0.95, roughness: 0.0, thickness: 6,
                tint: 0xAABBCC,
                fragments: 150, fragmentType: 'shard',
                fragmentSize: { min: 0.06, max: 0.18 },
                spreadRadius: 1.3, safety: 30, sound: 'shatter-sharp',
                breakMessage: 'Estilhaços pontiagudos e afiados!',
                breakDetail: 'PERIGO - podem causar cortes graves',
                safetyIcon: '❌',
                safetyLabel: 'PERIGOSO'
            }
        },
        // Multiplicador de fragmentos baseado no dispositivo
        getFragmentCount: function(type) {
            const base = this.glassTypes[type].fragments;
            if (isLowEnd) return Math.floor(base * 0.3); // 30% em dispositivos fracos
            if (isMobile) return Math.floor(base * 0.5); // 50% em mobile
            return base;
        }
    };

    // Estado global
    let scene, camera, renderer, glass, floor, hammer, frame;
    let mouseLight, impactBall, crackTexture, sparkles, rainDrops = [];
    let fingerMarks = [], thicknessIndicator;
    let fragments = [], dustParticles = [];
    let isMouseDown = false, mouseX = 0, mouseY = 0;
    let targetRotationX = 0, targetRotationY = 0;
    let currentGlassType = 'temperado';
    let isBroken = false, animationId = null;
    let slowMotion = false, slowMotionFactor = 1;
    let hammerMode = false, nightMode = false, rainMode = false;
    let impactPoint = new THREE.Vector3();
    let audioContext = null;
    let container = null;
    
    // Detecção de mobile para otimizações
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
                     || window.innerWidth < 768;
    const isLowEnd = isMobile && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;

    // ========== INICIALIZAÇÃO ==========
    function init() {
        container = document.getElementById(CONFIG.container);
        if (!container) return;

        scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0x1a365d, 12, 30);

        const aspect = container.clientWidth / container.clientHeight;
        camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        camera.position.set(0, 1.5, 6);
        camera.lookAt(0, 0.5, 0);

        renderer = new THREE.WebGLRenderer({ 
            antialias: !isMobile, // Desativar antialias no mobile
            alpha: true,
            powerPreference: isMobile ? "low-power" : "high-performance"
        });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
        renderer.shadowMap.enabled = !isLowEnd; // Desativar sombras em dispositivos fracos
        renderer.shadowMap.type = isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(renderer.domElement);

        // Criar environment map para reflexos realistas
        createEnvironmentMap();

        initAudio();
        setupLights();
        createFloor();
        createBackgroundScene();
        createHammer();
        createImpactBall();
        createSparkles();
        createGlass(currentGlassType);
        createEnvironment();
        createExtraControls();
        setupEvents(container);
        animate();
    }

    // ========== ENVIRONMENT MAP PARA REFLEXOS ==========
    function createEnvironmentMap() {
        // Criar um cubeMap procedural para reflexos
        const size = 128;
        const data = new Uint8Array(size * size * 4);
        
        // Gradiente de céu
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;
                const t = y / size;
                
                // Céu azul gradiente
                data[i] = Math.floor(30 + t * 50);     // R
                data[i + 1] = Math.floor(80 + t * 80); // G
                data[i + 2] = Math.floor(150 + t * 60); // B
                data[i + 3] = 255;                      // A
            }
        }
        
        const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        texture.needsUpdate = true;
        
        // Usar como environment
        scene.environment = texture;
    }

    // ========== CENA DE FUNDO ==========
    function createBackgroundScene() {
        // Fundo simples e escuro para destacar o vidro
    }

    // ========== ÁUDIO ==========
    function initAudio() {
        try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { console.log('Audio não suportado'); }
    }

    function playBreakSound(type) {
        if (!audioContext) return;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        let freq = 800, dur = 0.3;
        if (type === 'shatter-small') { freq = 2000; dur = 0.2; }
        else if (type === 'shatter-large') { freq = 500; dur = 0.5; }
        else if (type === 'crack') { freq = 300; dur = 0.4; }
        else if (type === 'thud') { freq = 100; dur = 0.2; }

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + dur);
        gain.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + dur);
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start();
        osc.stop(audioContext.currentTime + dur);
    }

    function playTinkle() {
        if (!audioContext) return;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.frequency.setValueAtTime(3000 + Math.random() * 2000, audioContext.currentTime);
        gain.gain.setValueAtTime(0.03, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start();
        osc.stop(audioContext.currentTime + 0.08);
    }

    function playRainSound() {
        if (!audioContext) return;
        const noise = audioContext.createBufferSource();
        const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 0.02 - 0.01;
        noise.buffer = buffer;
        const gain = audioContext.createGain();
        gain.gain.setValueAtTime(0.05, audioContext.currentTime);
        noise.connect(gain);
        gain.connect(audioContext.destination);
        noise.start();
    }

    // ========== ILUMINAÇÃO REALISTA ==========
    function setupLights() {
        // Luz ambiente suave
        const ambient = new THREE.AmbientLight(0xffffff, isMobile ? 0.5 : 0.4);
        scene.add(ambient);
        
        // Luz principal (sol)
        const main = new THREE.DirectionalLight(0xffffff, 1.0);
        main.position.set(5, 10, 5);
        main.castShadow = !isMobile; // Desativa sombras no mobile
        if (!isMobile) {
            main.shadow.mapSize.width = 1024; // Reduzido de 2048
            main.shadow.mapSize.height = 1024;
            main.shadow.camera.near = 0.5;
            main.shadow.camera.far = 50;
            main.shadow.bias = -0.0001;
        }
        scene.add(main);

        // Luz de preenchimento azulada (simplificada no mobile)
        if (!isLowEnd) {
            const fill = new THREE.DirectionalLight(0x4299e1, 0.3);
            fill.position.set(-5, 3, -5);
            scene.add(fill);
        }

        // Luz de destaque quente (desativada no mobile)
        if (!isMobile) {
            const rim = new THREE.SpotLight(0xffa500, 0.6);
            rim.position.set(0, 8, -3);
            rim.angle = Math.PI / 4;
            rim.penumbra = 0.5;
            scene.add(rim);
        }

        // Luz que segue o mouse para reflexos dinâmicos (simplificada no mobile)
        mouseLight = new THREE.PointLight(0xffffff, isMobile ? 0.4 : 0.6, isMobile ? 6 : 10);
        mouseLight.position.set(0, 0, 4);
        scene.add(mouseLight);
        
        // Hemisphere light para iluminação natural (desativada em low-end)
        if (!isLowEnd) {
            const hemi = new THREE.HemisphereLight(0x87CEEB, 0x1a365d, 0.3);
            scene.add(hemi);
        }
    }

    function setNightMode(enabled) {
        nightMode = enabled;
        scene.fog = new THREE.Fog(enabled ? 0x050510 : 0x1a365d, 10, 25);
        
        scene.children.forEach(child => {
            if (child.isAmbientLight) child.intensity = enabled ? 0.1 : 0.4;
            if (child.isDirectionalLight) child.intensity = enabled ? 0.2 : 1.0;
            if (child.isHemisphereLight) child.intensity = enabled ? 0.1 : 0.3;
        });
        
        if (mouseLight) mouseLight.intensity = enabled ? 1.2 : 0.6;
        
        // Atualizar cor do chão
        if (floor) {
            floor.material.color.setHex(enabled ? 0x0a1020 : 0x1a365d);
        }
    }

    // ========== AMBIENTE ==========
    function createFloor() {
        // Chão escuro
        const floorGeo = new THREE.PlaneGeometry(15, 15);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x0a1525,
            roughness: 0.6,
            metalness: 0.2
        });
        floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -2;
        floor.receiveShadow = true;
        scene.add(floor);

        // Grade sutil
        const grid = new THREE.GridHelper(15, 30, 0x2a4a6a, 0x1a2a3a);
        grid.position.y = -1.99;
        grid.material.opacity = 0.25;
        grid.material.transparent = true;
        scene.add(grid);

        // Parede de fundo escura
        const wallMat = new THREE.MeshStandardMaterial({ 
            color: 0x0a1520,
            roughness: 0.9,
            metalness: 0.0
        });
        const wall = new THREE.Mesh(
            new THREE.PlaneGeometry(15, 10),
            wallMat
        );
        wall.position.set(0, 3, -5);
        wall.receiveShadow = true;
        scene.add(wall);
    }

    function createEnvironment() {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(100 * 3);
        for (let i = 0; i < 300; i += 3) {
            pos[i] = (Math.random() - 0.5) * 15;
            pos[i+1] = (Math.random() - 0.5) * 10;
            pos[i+2] = (Math.random() - 0.5) * 10;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ color: 0x4299e1, size: 0.03, transparent: true, opacity: 0.3 });
        scene.add(new THREE.Points(geo, mat));
    }

    // ========== BOLA DE IMPACTO ==========
    function createImpactBall() {
        const geo = new THREE.SphereGeometry(0.15, 16, 16);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0xff4444, 
            metalness: 0.8, 
            roughness: 0.2,
            emissive: 0x441111
        });
        impactBall = new THREE.Mesh(geo, mat);
        impactBall.visible = false;
        impactBall.castShadow = true;
        scene.add(impactBall);
    }

    function animateImpactBall(target, callback) {
        impactBall.visible = true;
        const start = new THREE.Vector3(target.x + 3, target.y + 2, 5);
        impactBall.position.copy(start);
        
        let p = 0;
        const anim = () => {
            p += 0.08;
            if (p < 1) {
                impactBall.position.lerpVectors(start, target, p);
                impactBall.rotation.x += 0.2;
                impactBall.rotation.z += 0.15;
                requestAnimationFrame(anim);
            } else {
                if (callback) callback();
                setTimeout(() => {
                    impactBall.visible = false;
                    impactBall.position.set(0, 0, 10);
                }, 200);
            }
        };
        anim();
    }

    // ========== REFLEXOS REALISTAS ==========
    function createSparkles() {
        // Desativar sparkles em dispositivos low-end
        if (isLowEnd) {
            sparkles = null;
            return;
        }
        
        // Criar reflexo de luz na superfície (specular highlight)
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = isMobile ? 64 : 128; // Menor no mobile
        const ctx = canvas.getContext('2d');
        const size = canvas.width;
        
        // Gradiente para reflexo suave
        const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2 - 4);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        const texture = new THREE.CanvasTexture(canvas);
        const reflectMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        sparkles = new THREE.Mesh(
            new THREE.PlaneGeometry(1.5, 1.5),
            reflectMat
        );
        sparkles.position.set(-0.3, 0.5, 0.042);
    }

    function updateSparkles() {
        if (!sparkles || !glass || !glass.visible || !mouseLight) return;
        
        // No mobile, atualizar menos frequentemente
        if (isMobile && frameCount % 2 !== 0) return;
        
        // Mover o reflexo baseado na posição da luz do mouse
        const lightPos = mouseLight.position;
        sparkles.position.x = lightPos.x * 0.2;
        sparkles.position.y = lightPos.y * 0.15 + 0.3;
        sparkles.material.opacity = 0.2 + Math.abs(lightPos.x) * 0.1;
    }

    // ========== CHUVA REALISTA ==========
    function createRainDrop() {
        // Gota 3D mais realista
        const dropGeo = new THREE.SphereGeometry(0.025, 8, 6);
        dropGeo.scale(1, 1.5, 0.5); // Formato de gota
        
        const dropMat = new THREE.MeshPhysicalMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.7,
            roughness: 0,
            metalness: 0,
            transmission: 0.9,
            thickness: 0.1,
            ior: 1.33, // Água
            clearcoat: 1
        });
        
        const drop = new THREE.Mesh(dropGeo, dropMat);
        drop.position.set(
            (Math.random() - 0.5) * 2.2,
            1.6,
            0.05
        );
        drop.userData.speed = 0.008 + Math.random() * 0.012;
        drop.userData.wobble = Math.random() * Math.PI * 2;
        drop.userData.size = 0.8 + Math.random() * 0.4;
        drop.scale.setScalar(drop.userData.size);
        
        return drop;
    }

    function updateRain() {
        if (!rainMode || !glass || !glass.visible) return;
        
        // Limites otimizados para dispositivo
        const maxDrops = isMobile ? 10 : 20;
        const dropChance = isMobile ? 0.9 : 0.85;
        
        // Adicionar novas gotas
        if (Math.random() > dropChance && rainDrops.length < maxDrops) {
            const drop = createRainDrop();
            glass.add(drop);
            rainDrops.push(drop);
            if (Math.random() > 0.9) playRainSound();
        }
        
        // Atualizar gotas existentes
        for (let i = rainDrops.length - 1; i >= 0; i--) {
            const drop = rainDrops[i];
            
            // Movimento com gravidade e oscilação
            drop.userData.wobble += 0.1;
            drop.position.y -= drop.userData.speed;
            drop.position.x += Math.sin(drop.userData.wobble) * 0.002;
            
            // Acelerar conforme cai
            drop.userData.speed += 0.0002;
            
            // Esticar a gota conforme acelera
            drop.scale.y = drop.userData.size * (1 + drop.userData.speed * 5);
            
            // Remover quando sair da tela
            if (drop.position.y < -1.6) {
                glass.remove(drop);
                drop.geometry.dispose();
                drop.material.dispose();
                rainDrops.splice(i, 1);
            }
        }
    }

    function toggleRain(enabled) {
        rainMode = enabled;
        if (!enabled) {
            rainDrops.forEach(drop => {
                if (glass) glass.remove(drop);
            });
            rainDrops = [];
        }
    }

    // ========== MARCAS DE DEDO REALISTAS ==========
    function addFingerMark(x, y) {
        if (!glass || isBroken) return;
        
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Limpar
        ctx.clearRect(0, 0, 128, 128);
        
        // Gradiente para marca de dedo realista
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 50);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(64, 64, 25, 35, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Linhas das digitais
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            const yOffset = 40 + i * 5;
            ctx.arc(64, yOffset, 15 - i * 0.5, 0.2, Math.PI - 0.2);
            ctx.stroke();
        }
        
        // Manchas de oleosidade
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(
                64 + (Math.random() - 0.5) * 30,
                64 + (Math.random() - 0.5) * 40,
                Math.random() * 8 + 3,
                0, Math.PI * 2
            );
            ctx.fill();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        const mark = new THREE.Mesh(
            new THREE.PlaneGeometry(0.35, 0.45),
            new THREE.MeshBasicMaterial({ 
                map: texture, 
                transparent: true, 
                opacity: 0.6,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        
        mark.position.set(x, y, 0.042);
        mark.rotation.z = (Math.random() - 0.5) * 0.4;
        mark.userData.life = 1;
        
        glass.add(mark);
        fingerMarks.push(mark);
        
        // Limitar quantidade
        if (fingerMarks.length > 6) {
            const old = fingerMarks.shift();
            if (glass) glass.remove(old);
            old.geometry.dispose();
            old.material.dispose();
        }
    }

    function updateFingerMarks() {
        for (let i = fingerMarks.length - 1; i >= 0; i--) {
            const mark = fingerMarks[i];
            mark.userData.life -= 0.001;
            mark.material.opacity = mark.userData.life * 0.6;
            
            if (mark.userData.life <= 0) {
                if (glass) glass.remove(mark);
                mark.geometry.dispose();
                mark.material.dispose();
                fingerMarks.splice(i, 1);
            }
        }
    }

    // ========== INDICADOR DE ESPESSURA ==========
    function updateThicknessIndicator() {
        const cfg = CONFIG.glassTypes[currentGlassType];
        const el = document.getElementById('thickness-indicator');
        if (el) {
            el.innerHTML = `<i class="fas fa-ruler-vertical"></i> ${cfg.thickness}mm`;
        }
    }

    // ========== MARTELO ==========
    function createHammer() {
        const group = new THREE.Group();
        
        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.06, 0.8, 8),
            new THREE.MeshStandardMaterial({ color: 0x8B4513 })
        );
        handle.rotation.z = Math.PI / 4;
        group.add(handle);

        const head = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.12, 0.3),
            new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.8 })
        );
        head.position.set(0.35, 0.35, 0);
        group.add(head);

        group.position.set(3, 2, 2);
        group.visible = false;
        hammer = group;
        scene.add(hammer);
    }

    function strikeWithHammer(target) {
        if (!hammer) return;
        hammer.visible = true;
        
        const start = new THREE.Vector3(target.x + 2, target.y + 2, target.z + 2);
        hammer.position.copy(start);
        
        let p = 0;
        const anim = () => {
            p += 0.15;
            if (p < 1) {
                hammer.position.lerpVectors(start, target, p);
                hammer.rotation.z = -Math.PI/4 + p * Math.PI/2;
                requestAnimationFrame(anim);
            } else {
                breakGlass(target);
                setTimeout(() => { hammer.visible = false; }, 400);
            }
        };
        anim();
    }

    // ========== MOLDURA ==========
    function createFrame() {
        if (frame) {
            if (frame.parent) frame.parent.remove(frame);
            else scene.remove(frame);
        }
        
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.6 });
        const w = 2.5, h = 3, f = 0.1;

        const top = new THREE.Mesh(new THREE.BoxGeometry(w + f*2, f, 0.12), mat);
        top.position.set(0, h/2 + f/2, 0);
        group.add(top);

        const bot = top.clone();
        bot.position.y = -h/2 - f/2;
        group.add(bot);

        const left = new THREE.Mesh(new THREE.BoxGeometry(f, h, 0.12), mat);
        left.position.set(-w/2 - f/2, 0, 0);
        group.add(left);

        const right = left.clone();
        right.position.x = w/2 + f/2;
        group.add(right);

        frame = group;
    }

    // ========== TEXTURA DE RACHADURA ==========
    function createCrackTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, 512, 512);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        
        // Centro da rachadura
        const cx = 256, cy = 256;
        
        // Linhas principais
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const length = 100 + Math.random() * 150;
            
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            
            let x = cx, y = cy;
            const segments = 5 + Math.floor(Math.random() * 5);
            
            for (let j = 0; j < segments; j++) {
                const segLen = length / segments;
                x += Math.cos(angle + (Math.random() - 0.5) * 0.5) * segLen;
                y += Math.sin(angle + (Math.random() - 0.5) * 0.5) * segLen;
                ctx.lineTo(x, y);
                
                // Ramificações
                if (Math.random() > 0.6) {
                    ctx.moveTo(x, y);
                    const branchAngle = angle + (Math.random() - 0.5) * 1.5;
                    const branchLen = 20 + Math.random() * 40;
                    ctx.lineTo(
                        x + Math.cos(branchAngle) * branchLen,
                        y + Math.sin(branchAngle) * branchLen
                    );
                    ctx.moveTo(x, y);
                }
            }
            ctx.stroke();
        }
        
        // Círculos concêntricos
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        for (let r = 30; r < 200; r += 40) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        return new THREE.CanvasTexture(canvas);
    }

    function showCrackEffect(impactPos) {
        if (!glass) return;
        
        const crackMat = new THREE.MeshBasicMaterial({
            map: createCrackTexture(),
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        const crack = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            crackMat
        );
        
        crack.position.set(
            impactPos ? impactPos.x * 0.3 : 0,
            impactPos ? (impactPos.y - 0.5) * 0.3 : 0,
            0.035
        );
        
        glass.add(crack);
        
        // Animação de aparecimento
        let opacity = 0;
        const fadeIn = () => {
            opacity += 0.15;
            crackMat.opacity = Math.min(opacity, 0.9);
            if (opacity < 0.9) {
                requestAnimationFrame(fadeIn);
            } else {
                // Após mostrar rachadura, quebrar
                setTimeout(() => {
                    glass.remove(crack);
                }, 100);
            }
        };
        fadeIn();
    }

    // ========== VIDRO ==========
    function createGlass(type) {
        if (glass) {
            scene.remove(glass);
            glass.geometry.dispose();
            glass.material.dispose();
        }
        clearFragments();
        fingerMarks = [];
        rainDrops = [];

        const cfg = CONFIG.glassTypes[type];
        
        // Geometria do vidro
        const thickness = cfg.thickness / 100; // Converter mm para unidades 3D
        const geo = new THREE.BoxGeometry(2.5, 3, thickness);
        
        // Material ULTRA realista baseado no tipo
        // No mobile/low-end, usar materiais mais simples
        let mat;
        
        if (isLowEnd) {
            // Material simplificado para dispositivos fracos
            mat = new THREE.MeshStandardMaterial({
                color: cfg.tint || cfg.color,
                transparent: true,
                opacity: cfg.opacity + 0.2,
                roughness: cfg.roughness + 0.1,
                metalness: type === 'espelho' ? 0.9 : 0.1,
                side: THREE.DoubleSide
            });
        } else if (type === 'espelho') {
            // Espelho - altamente reflexivo com borda visível
            mat = new THREE.MeshPhysicalMaterial({
                color: 0xCCDDEE,
                metalness: 0.95,
                roughness: 0.02,
                envMapIntensity: isMobile ? 1.0 : 1.5,
                clearcoat: 1.0,
                clearcoatRoughness: 0.0,
                reflectivity: 0.9
            });
        } else if (type === 'fantasia') {
            // Fantasia - texturizado e difuso
            mat = new THREE.MeshPhysicalMaterial({
                color: cfg.color,
                transparent: true,
                opacity: cfg.opacity,
                roughness: cfg.roughness,
                metalness: 0.0,
                transmission: isMobile ? 0.3 : 0.4,
                thickness: 0.3,
                ior: 1.5,
                clearcoat: isMobile ? 0.2 : 0.3,
                side: THREE.DoubleSide
            });
        } else {
            // Temperado e Laminado - vidro transparente visível
            mat = new THREE.MeshPhysicalMaterial({
                color: cfg.tint || cfg.color,
                transparent: true,
                opacity: cfg.opacity + 0.3,
                roughness: cfg.roughness,
                metalness: 0.1,
                
                // Propriedades de vidro (simplificadas no mobile)
                transmission: isMobile ? 0.5 : 0.7,
                thickness: thickness * 3,
                ior: 1.5,
                
                clearcoat: isMobile ? 0.6 : 1.0,
                clearcoatRoughness: 0.05,
                reflectivity: 0.3,
                
                side: THREE.DoubleSide,
                envMapIntensity: isMobile ? 0.5 : 0.8
            });
        }

        glass = new THREE.Mesh(geo, mat);
        glass.castShadow = !isMobile; // Desativar sombras no mobile
        glass.receiveShadow = !isMobile;
        glass.position.y = 0.5;

        // Bordas verdes realistas (borda do vidro - característica real)
        const edgeColor = type === 'espelho' ? 0x1a1a1a : 0x3d6b4d;
        const edgeMat = new THREE.MeshStandardMaterial({
            color: edgeColor,
            roughness: 0.2,
            metalness: 0.1
        });
        
        // Bordas com espessura realista
        const edgeThickness = thickness + 0.005;
        
        // Borda superior
        const edgeTop = new THREE.Mesh(
            new THREE.BoxGeometry(2.5, 0.008, edgeThickness),
            edgeMat
        );
        edgeTop.position.y = 1.5;
        glass.add(edgeTop);
        
        // Borda inferior
        const edgeBot = edgeTop.clone();
        edgeBot.position.y = -1.5;
        glass.add(edgeBot);
        
        // Borda esquerda
        const edgeLeft = new THREE.Mesh(
            new THREE.BoxGeometry(0.008, 3, edgeThickness),
            edgeMat
        );
        edgeLeft.position.x = -1.25;
        glass.add(edgeLeft);
        
        // Borda direita
        const edgeRight = edgeLeft.clone();
        edgeRight.position.x = 1.25;
        glass.add(edgeRight);

        // Textura fantasia - padrão martelado realista
        if (type === 'fantasia' && !isLowEnd) { // Desativar textura complexa em low-end
            const canvas = document.createElement('canvas');
            const texSize = isMobile ? 256 : 512; // Menor no mobile
            canvas.width = canvas.height = texSize;
            const ctx = canvas.getContext('2d');
            
            // Fundo
            ctx.fillStyle = '#f8f8f8';
            ctx.fillRect(0, 0, texSize, texSize);
            
            // Padrão martelado - menos iterações no mobile
            const iterations = isMobile ? 80 : 200;
            for (let i = 0; i < iterations; i++) {
                const x = Math.random() * texSize;
                const y = Math.random() * texSize;
                const r = Math.random() * 25 + 10;
                
                const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
                grad.addColorStop(0, 'rgba(255,255,255,0.4)');
                grad.addColorStop(0.5, 'rgba(200,200,200,0.2)');
                grad.addColorStop(1, 'rgba(180,180,180,0.1)');
                
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
            
            const fantasyTexture = new THREE.CanvasTexture(canvas);
            glass.material.bumpMap = fantasyTexture;
            glass.material.bumpScale = 0.02;
        }

        // Adicionar sparkles (reflexo de luz)
        if (sparkles) glass.add(sparkles);

        scene.add(glass);
        createFrame();
        if (frame) glass.add(frame);
        
        isBroken = false;
        updateInfo(type);
        updateSafety(cfg.safety);
        updateThicknessIndicator();
        
        // Voltar câmera à posição original quando trocar de vidro
        animateCameraToGlass();
    }

    // ========== PARTÍCULAS DE POEIRA ==========
    function createDust(pos, intensity) {
        // Desativar poeira no mobile para performance
        if (isMobile) return;
        
        const dustCount = Math.min(40 * intensity, isLowEnd ? 10 : 25); // Limitar quantidade
        for (let i = 0; i < dustCount; i++) {
            const dust = new THREE.Mesh(
                new THREE.SphereGeometry(Math.random() * 0.02 + 0.01, 3, 3), // Menos segmentos
                new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
            );
            dust.position.copy(pos);
            dust.position.x += (Math.random() - 0.5) * 0.5;
            dust.position.y += (Math.random() - 0.5) * 0.5;
            dust.userData.vel = new THREE.Vector3(
                (Math.random() - 0.5) * 0.04,
                Math.random() * 0.02,
                (Math.random() - 0.5) * 0.04
            );
            dust.userData.life = 1;
            scene.add(dust);
            dustParticles.push(dust);
        }
    }

    // ========== QUEBRA ==========
    function createFragment(cfg, impactPos) {
        const size = cfg.fragmentSize.min + Math.random() * (cfg.fragmentSize.max - cfg.fragmentSize.min);
        let geo;
        const glassType = currentGlassType;
        
        // Qualidade das geometrias (maior no desktop)
        const segments = isMobile ? 1 : 2;
        const curveSegments = isMobile ? 4 : 8;

        switch (cfg.fragmentType) {
            case 'cube':
                // Temperado: cubos pequenos - característico do vidro temperado
                const cubeSize = size * (0.8 + Math.random() * 0.4);
                geo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize * 0.5, segments, segments, segments);
                break;
                
            case 'crack':
                // Laminado: pedaços grandes com bordas mais suaves
                const crackShape = new THREE.Shape();
                const crackPts = 6 + Math.floor(Math.random() * 4);
                for (let i = 0; i < crackPts; i++) {
                    const a = (i / crackPts) * Math.PI * 2;
                    const r = size * (0.5 + Math.random() * 0.5);
                    if (i === 0) crackShape.moveTo(Math.cos(a)*r, Math.sin(a)*r);
                    else crackShape.lineTo(Math.cos(a)*r, Math.sin(a)*r);
                }
                crackShape.closePath();
                geo = new THREE.ExtrudeGeometry(crackShape, { 
                    depth: 0.08, 
                    bevelEnabled: true, 
                    bevelSize: 0.012, 
                    bevelThickness: 0.012,
                    bevelSegments: segments,
                    curveSegments: curveSegments
                });
                break;
                
            case 'irregular':
                // Fantasia: pedaços irregulares texturizados
                const shape = new THREE.Shape();
                const pts = 5 + Math.floor(Math.random() * 4);
                for (let i = 0; i < pts; i++) {
                    const a = (i / pts) * Math.PI * 2 + Math.random() * 0.4;
                    const r = size * (0.4 + Math.random() * 0.6);
                    if (i === 0) shape.moveTo(Math.cos(a)*r, Math.sin(a)*r);
                    else shape.lineTo(Math.cos(a)*r, Math.sin(a)*r);
                }
                shape.closePath();
                geo = new THREE.ExtrudeGeometry(shape, { 
                    depth: 0.05, 
                    bevelEnabled: true, 
                    bevelSize: 0.008, 
                    bevelThickness: 0.008,
                    bevelSegments: segments,
                    curveSegments: curveSegments
                });
                break;
                
            case 'shard':
                // Espelho: estilhaços longos e pontiagudos - perigosos
                const s = new THREE.Shape();
                const shardLength = size * (1.8 + Math.random() * 0.8);
                const shardWidth = size * (0.25 + Math.random() * 0.35);
                // Forma mais detalhada de estilhaço
                s.moveTo(0, shardLength);
                s.lineTo(shardWidth * 0.6, shardLength * 0.5);
                s.lineTo(shardWidth, shardLength * 0.2);
                s.lineTo(shardWidth * 0.8, -shardLength * 0.1);
                s.lineTo(shardWidth * 0.4, -shardLength * 0.4);
                s.lineTo(0, -shardLength * 0.5);
                s.lineTo(-shardWidth * 0.3, -shardLength * 0.35);
                s.lineTo(-shardWidth * 0.7, shardLength * 0.05);
                s.lineTo(-shardWidth * 0.5, shardLength * 0.4);
                s.lineTo(-shardWidth * 0.2, shardLength * 0.7);
                s.closePath();
                geo = new THREE.ExtrudeGeometry(s, { 
                    depth: 0.02, 
                    bevelEnabled: true, 
                    bevelSize: 0.004, 
                    bevelThickness: 0.004,
                    bevelSegments: segments,
                    curveSegments: curveSegments
                });
                break;
                
            default:
                geo = new THREE.TetrahedronGeometry(size, 1);
        }

        // Material de alta qualidade para cada tipo
        let mat;
        
        if (glassType === 'espelho') {
            // Espelho: superfície espelhada com reflexo
            mat = new THREE.MeshPhysicalMaterial({
                color: 0xF0F0F0,
                metalness: 1.0,
                roughness: 0.0,
                clearcoat: 1.0,
                clearcoatRoughness: 0,
                reflectivity: 1.0,
                envMapIntensity: 2.0,
                side: THREE.DoubleSide
            });
        } else if (glassType === 'temperado') {
            // Temperado: vidro verde-azulado translúcido com borda verde
            mat = new THREE.MeshPhysicalMaterial({
                color: 0x9EEEFF,
                transparent: true,
                opacity: 0.8,
                roughness: 0.02,
                metalness: 0.0,
                transmission: 0.7,
                thickness: 0.1,
                ior: 1.52,
                clearcoat: 1.0,
                clearcoatRoughness: 0.02,
                envMapIntensity: 0.8,
                // Cor verde na borda (atenuação)
                attenuationColor: new THREE.Color(0x44AA88),
                attenuationDistance: 0.15,
                side: THREE.DoubleSide
            });
        } else if (glassType === 'laminado') {
            // Laminado: verde translúcido com película visível
            mat = new THREE.MeshPhysicalMaterial({
                color: 0xAAFFCC,
                transparent: true,
                opacity: 0.8,
                roughness: 0.08,
                metalness: 0.0,
                transmission: 0.6,
                thickness: 0.12,
                ior: 1.5,
                clearcoat: 0.8,
                clearcoatRoughness: 0.05,
                envMapIntensity: 0.6,
                attenuationColor: new THREE.Color(0x55BB77),
                attenuationDistance: 0.2,
                side: THREE.DoubleSide
            });
        } else {
            // Fantasia: fosco texturizado com padrão
            mat = new THREE.MeshPhysicalMaterial({
                color: 0xF5F5F5,
                transparent: true,
                opacity: 0.9,
                roughness: 0.4,
                metalness: 0.0,
                transmission: 0.35,
                thickness: 0.06,
                ior: 1.5,
                clearcoat: 0.4,
                clearcoatRoughness: 0.3,
                envMapIntensity: 0.4,
                side: THREE.DoubleSide
            });
        }

        const frag = new THREE.Mesh(geo, mat);
        frag.castShadow = !isMobile;
        frag.receiveShadow = !isMobile;

        const dist = new THREE.Vector3(
            (Math.random() - 0.5) * 2.5,
            (Math.random() - 0.5) * 3,
            0
        );
        
        if (impactPos) {
            dist.x = dist.x * 0.7 + impactPos.x * 0.3;
            dist.y = dist.y * 0.7 + impactPos.y * 0.3;
        }

        frag.position.set(
            (glass ? glass.position.x : 0) + dist.x,
            0.5 + dist.y,
            (Math.random() - 0.5) * 0.1
        );

        frag.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);

        const dir = impactPos ? 
            new THREE.Vector3(frag.position.x - impactPos.x, frag.position.y - impactPos.y, -1).normalize() :
            new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, -1);

        const spread = cfg.spreadRadius;
        const forceMultiplier = 0.8 + Math.random() * 0.4;
        frag.userData.vel = cfg.staysOnFilm ?
            new THREE.Vector3(dir.x * 0.02, -0.02, -0.03) :
            new THREE.Vector3(
                dir.x * spread * 0.04 * forceMultiplier, 
                Math.random() * 0.03, 
                -Math.abs(dir.z * 0.05 + 0.02) * forceMultiplier
            );

        frag.userData.rotSpeed = new THREE.Vector3(
            (Math.random()-0.5)*0.2,
            (Math.random()-0.5)*0.2,
            (Math.random()-0.5)*0.2
        );
        frag.userData.groundY = -1.92 + Math.random() * 0.05;
        frag.userData.settled = false;
        frag.userData.bounces = 0;

        return frag;
    }

    function breakGlass(impactPos) {
        if (isBroken || !glass) return;
        
        const cfg = CONFIG.glassTypes[currentGlassType];

        // Mostrar rachadura primeiro
        showCrackEffect(impactPos);

        // Delay para ver a rachadura
        setTimeout(() => {
            isBroken = true;

            if (slowMotion) {
                slowMotionFactor = 0.2;
                setTimeout(() => { slowMotionFactor = 1; }, 2000);
            }

            playBreakSound(cfg.sound);
            
            // Usar quantidade de fragmentos otimizada para o dispositivo
            const fragmentCount = CONFIG.getFragmentCount(currentGlassType);
            
            createDust(impactPos || glass.position.clone(), fragmentCount / 100);

            glass.visible = false;

            for (let i = 0; i < fragmentCount; i++) {
                const frag = createFragment(cfg, impactPos);
                scene.add(frag);
                fragments.push(frag);
            }

            const canvas = document.getElementById(CONFIG.container);
            if (canvas) {
                canvas.classList.add('glass-breaking');
                setTimeout(() => canvas.classList.remove('glass-breaking'), 300);
            }

            animateCameraDown();
            updateCounter(fragmentCount);
            
            // Mostrar mensagem didática após quebrar
            showBreakMessage(cfg);
        }, 200);
    }
    
    // Mostrar mensagem educativa após quebrar
    function showBreakMessage(cfg) {
        // Remover mensagem anterior se existir
        const existing = document.getElementById('break-message-overlay');
        if (existing) existing.remove();
        
        const isSafe = cfg.safety >= 80;
        const isWarning = cfg.safety >= 50 && cfg.safety < 80;
        const isDanger = cfg.safety < 50;
        
        const overlay = document.createElement('div');
        overlay.id = 'break-message-overlay';
        overlay.className = 'break-message-overlay';
        overlay.innerHTML = `
            <div class="break-message ${isSafe ? 'safe' : isWarning ? 'warning' : 'danger'}">
                <div class="break-icon">${cfg.safetyIcon}</div>
                <div class="break-text">
                    <h4>${cfg.breakMessage}</h4>
                    <p>${cfg.breakDetail}</p>
                </div>
                <div class="break-label ${isSafe ? 'safe' : isWarning ? 'warning' : 'danger'}">${cfg.safetyLabel}</div>
            </div>
        `;
        
        const container = document.getElementById(CONFIG.container);
        if (container) {
            container.appendChild(overlay);
            
            // Animar entrada
            setTimeout(() => overlay.classList.add('visible'), 50);
            
            // Remover após 4 segundos
            setTimeout(() => {
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 500);
            }, 4000);
        }
    }

    function animateCameraDown() {
        // Câmera olhando de cima para ver fragmentos no chão
        // No mobile, aproxima mais para ver detalhes
        const targetY = isMobile ? 2.5 : 3.5;
        const targetZ = isMobile ? 2 : 3;
        const lookAtY = -1.8;
        let progress = 0;
        
        const anim = () => {
            progress += 0.025 * slowMotionFactor;
            const eased = 1 - Math.pow(1 - Math.min(progress, 1), 3);
            
            camera.position.y += (targetY - camera.position.y) * 0.05 * slowMotionFactor;
            camera.position.z += (targetZ - camera.position.z) * 0.05 * slowMotionFactor;
            
            const currentLookY = THREE.MathUtils.lerp(0, lookAtY, eased);
            camera.lookAt(0, currentLookY, -1);
            
            if (Math.abs(camera.position.y - targetY) > 0.02 || progress < 1) {
                requestAnimationFrame(anim);
            }
        };
        anim();
    }

    function clearFragments() {
        fragments.forEach(f => { scene.remove(f); f.geometry.dispose(); f.material.dispose(); });
        fragments = [];
        dustParticles.forEach(d => { scene.remove(d); d.geometry.dispose(); d.material.dispose(); });
        dustParticles = [];
    }

    function resetGlass() {
        clearFragments();
        if (glass) { glass.visible = true; glass.rotation.set(0,0,0); }
        targetRotationX = targetRotationY = 0;
        isBroken = false;
        
        // Voltar câmera à posição original olhando para o vidro
        animateCameraToGlass();
        updateCounter(0);
    }
    
    function animateCameraToGlass() {
        const anim = () => {
            const f = 0.06;
            camera.position.x += (0 - camera.position.x) * f;
            camera.position.y += (2 - camera.position.y) * f;
            camera.position.z += (7 - camera.position.z) * f;
            camera.lookAt(0, 0, 0);
            
            const distY = Math.abs(camera.position.y - 2);
            const distZ = Math.abs(camera.position.z - 7);
            if (distY > 0.02 || distZ > 0.02) requestAnimationFrame(anim);
        };
        anim();
    }

    // ========== UI ==========
    function updateInfo(type) {
        const cfg = CONFIG.glassTypes[type];
        const t = document.getElementById('glass-title');
        const d = document.getElementById('glass-desc');
        const th = document.getElementById('glass-thickness');
        
        if (t) t.textContent = cfg.title;
        if (d) d.textContent = cfg.desc;
        if (th) th.innerHTML = `<i class="fas fa-ruler-vertical"></i> ${cfg.thickness}mm`;
        
        // Atualizar barra de segurança com ícone
        updateSafety(cfg.safety, cfg.safetyIcon, cfg.safetyLabel);
    }

    function updateSafety(val, icon, label) {
        const fill = document.getElementById('safety-fill');
        const percent = document.getElementById('safety-percent');
        
        if (fill) {
            fill.style.width = val + '%';
            fill.classList.remove('low', 'medium');
            if (val <= 40) fill.classList.add('low');
            else if (val <= 70) fill.classList.add('medium');
        }
        if (percent) {
            // Mostrar ícone + porcentagem + label
            const iconHtml = icon ? `<span class="safety-icon">${icon}</span> ` : '';
            const labelHtml = label ? ` <span class="safety-label-text">${label}</span>` : '';
            percent.innerHTML = `${iconHtml}${val}%${labelHtml}`;
            percent.style.color = val > 70 ? '#48bb78' : val > 40 ? '#ed8936' : '#e53e3e';
        }
    }

    function updateCounter(n) {
        const el = document.getElementById('fragment-counter');
        if (el) el.textContent = n > 0 ? `${n} fragmentos` : '';
    }

    function createExtraControls() {
        const infoCard = document.querySelector('.glass-info-card');
        if (!infoCard) return;

        // Extra controls
        const actions = document.querySelector('.glass-info-actions');
        if (actions && !document.getElementById('toggle-slowmo')) {
            actions.insertAdjacentHTML('afterend', `
                <div class="glass-extra-controls">
                    <button id="toggle-slowmo" class="btn-extra" title="Câmera Lenta"><i class="fas fa-clock"></i></button>
                    <button id="toggle-hammer" class="btn-extra" title="Modo Martelo"><i class="fas fa-hammer"></i></button>
                    <button id="toggle-night" class="btn-extra" title="Modo Noite"><i class="fas fa-moon"></i></button>
                    <button id="toggle-rain" class="btn-extra" title="Chuva"><i class="fas fa-cloud-rain"></i></button>
                    <button id="toggle-ball" class="btn-extra" title="Lançar Bola"><i class="fas fa-baseball-ball"></i></button>
                </div>
                <div id="fragment-counter" class="fragment-counter"></div>
            `);

            setTimeout(() => {
                document.getElementById('toggle-slowmo')?.addEventListener('click', function() {
                    slowMotion = !slowMotion;
                    this.classList.toggle('active', slowMotion);
                });

                document.getElementById('toggle-hammer')?.addEventListener('click', function() {
                    hammerMode = !hammerMode;
                    this.classList.toggle('active', hammerMode);
                    if (hammer) hammer.visible = hammerMode && !isBroken;
                });

                document.getElementById('toggle-night')?.addEventListener('click', function() {
                    setNightMode(!nightMode);
                    this.classList.toggle('active', nightMode);
                });

                document.getElementById('toggle-rain')?.addEventListener('click', function() {
                    toggleRain(!rainMode);
                    this.classList.toggle('active', rainMode);
                });

                document.getElementById('toggle-ball')?.addEventListener('click', function() {
                    if (!isBroken && glass) {
                        const target = new THREE.Vector3(
                            (Math.random() - 0.5) * 1,
                            (Math.random() - 0.5) * 1 + 0.5,
                            0
                        );
                        animateImpactBall(target, () => breakGlass(target));
                    }
                });
            }, 100);
        }
    }

    // ========== EVENTOS ==========
    function setupEvents(container) {
        container.addEventListener('mousedown', (e) => {
            if (hammerMode && !isBroken) {
                const rect = container.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                impactPoint.set(x * 1.5, y * 1.5 + 0.5, 0);
                strikeWithHammer(impactPoint);
                return;
            }
            isMouseDown = true;
            mouseX = e.clientX;
            mouseY = e.clientY;
            
            // Adicionar marca de dedo ao clicar
            if (!isBroken && glass) {
                const rect = container.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                addFingerMark(x * 1.25, y * 1.5);
            }
        });

        container.addEventListener('mousemove', (e) => {
            // Atualizar luz que segue o mouse
            if (mouseLight && container) {
                const rect = container.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                mouseLight.position.set(x * 3, y * 2 + 1, 4);
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;
            targetRotationY += (e.clientX - mouseX) * 0.01;
            targetRotationX += (e.clientY - mouseY) * 0.005;
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        document.addEventListener('mouseup', () => { isMouseDown = false; });

        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isMouseDown = true;
                mouseX = e.touches[0].clientX;
                mouseY = e.touches[0].clientY;
            }
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (!isMouseDown || e.touches.length !== 1) return;
            targetRotationY += (e.touches[0].clientX - mouseX) * 0.01;
            targetRotationX += (e.touches[0].clientY - mouseY) * 0.005;
            mouseX = e.touches[0].clientX;
            mouseY = e.touches[0].clientY;
        }, { passive: true });

        container.addEventListener('touchend', () => { isMouseDown = false; });

        // Double tap para mobile (quebrar vidro)
        let lastTap = 0;
        container.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            
            if (tapLength < 300 && tapLength > 0) {
                // Double tap detectado!
                if (!isBroken && !hammerMode && e.changedTouches.length > 0) {
                    const touch = e.changedTouches[0];
                    const rect = container.getBoundingClientRect();
                    const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
                    const y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
                    impactPoint.set(x * 1.5, y * 1.5 + 0.5, 0);
                    breakGlass(impactPoint);
                }
                e.preventDefault();
            }
            lastTap = currentTime;
        });

        // Pinch-to-zoom no mobile
        let initialPinchDistance = 0;
        let initialCameraZ = camera.position.z;
        
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
                initialCameraZ = camera.position.z;
            }
        }, { passive: true });
        
        container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const scale = initialPinchDistance / distance;
                // Permite chegar bem mais perto (Z=1.5)
                camera.position.z = Math.max(1.5, Math.min(12, initialCameraZ * scale));
                e.preventDefault();
            }
        }, { passive: false });

        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            // Permite chegar mais perto (Z=2 no desktop)
            camera.position.z = Math.max(2, Math.min(12, camera.position.z + e.deltaY * 0.005));
        }, { passive: false });

        container.addEventListener('dblclick', (e) => {
            if (!isBroken && !hammerMode) {
                const rect = container.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                impactPoint.set(x * 1.5, y * 1.5 + 0.5, 0);
                breakGlass(impactPoint);
            }
        });

        document.querySelectorAll('.glass-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.glass-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentGlassType = this.dataset.glass;
                createGlass(currentGlassType);
            });
        });

        document.getElementById('break-glass')?.addEventListener('click', () => {
            if (!isBroken) {
                const target = new THREE.Vector3(0, 0.5, 0);
                animateImpactBall(target, () => breakGlass(target));
            }
        });
        document.getElementById('reset-glass')?.addEventListener('click', resetGlass);

        window.addEventListener('resize', () => {
            if (!container) return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        });
        
        // Pausar animação quando não está visível (IMPORTANTE para performance)
        if ('IntersectionObserver' in window) {
            const visibilityObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    isPaused = !entry.isIntersecting;
                });
            }, { threshold: 0.1 });
            
            visibilityObserver.observe(container);
        }
        
        // Também pausar quando a aba não está ativa
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                isPaused = true;
            }
        });
    }

    // ========== ANIMAÇÃO ==========
    let frameCount = 0;
    let lastTime = 0;
    const targetFPS = isLowEnd ? 24 : (isMobile ? 30 : 60); // Limitar FPS ainda mais em low-end
    const frameInterval = 1000 / targetFPS;
    let isPaused = false; // Para pausar quando não visível
    
    function animate(currentTime) {
        animationId = requestAnimationFrame(animate);
        
        // Pausar quando não visível
        if (isPaused) return;
        
        // Throttle de FPS em todos os dispositivos para economia de bateria
        if (currentTime - lastTime < frameInterval) return;
        lastTime = currentTime;
        
        frameCount++;
        
        const f = slowMotionFactor;
        
        // No mobile, pular alguns frames para efeitos secundários
        const skipFrame = isMobile && frameCount % 3 !== 0;

        // Rotação do vidro (sempre atualiza)
        if (glass && glass.visible) {
            if (!isMouseDown) targetRotationY += 0.003 * f;
            glass.rotation.x += (targetRotationX - glass.rotation.x) * 0.05 * f;
            glass.rotation.y += (targetRotationY - glass.rotation.y) * 0.05 * f;
        }

        // Atualizar efeitos (pula frames no mobile)
        if (!skipFrame) {
            updateSparkles();
            if (!isMobile) updateRain(); // Desativa chuva no mobile
            updateFingerMarks();
        }

        // Fragmentos (sempre atualiza para física correta, mas simplificado no mobile)
        const fragLimit = isMobile ? Math.min(fragments.length, 50) : fragments.length;
        for (let i = 0; i < fragLimit; i++) {
            const frag = fragments[i];
            if (frag.userData.settled) continue;
            
            frag.position.add(frag.userData.vel.clone().multiplyScalar(f));
            frag.userData.vel.y -= 0.003 * f;
            
            frag.rotation.x += frag.userData.rotSpeed.x * f;
            frag.rotation.y += frag.userData.rotSpeed.y * f;
            frag.rotation.z += frag.userData.rotSpeed.z * f;

            if (frag.position.y <= frag.userData.groundY) {
                frag.position.y = frag.userData.groundY;
                if (frag.userData.bounces < (isMobile ? 1 : 2) && Math.abs(frag.userData.vel.y) > 0.01) {
                    frag.userData.vel.y *= -0.25;
                    frag.userData.vel.x *= 0.7;
                    frag.userData.vel.z *= 0.7;
                    frag.userData.rotSpeed.multiplyScalar(0.4);
                    frag.userData.bounces++;
                } else {
                    frag.userData.vel.set(0,0,0);
                    frag.userData.rotSpeed.set(0,0,0);
                    frag.userData.settled = true;
                    frag.rotation.x = -Math.PI/2 + (Math.random()-0.5)*0.3;
                }
            }
            frag.userData.vel.x *= 0.99;
            frag.userData.vel.z *= 0.99;
        }

        // Poeira (desativado no mobile)
        if (!isMobile && !skipFrame) {
            dustParticles.forEach((d, i) => {
                d.position.add(d.userData.vel);
                d.userData.vel.y += 0.0002;
                d.userData.life -= 0.015 * f;
                d.material.opacity = d.userData.life * 0.5;
                if (d.userData.life <= 0) {
                    scene.remove(d);
                    dustParticles.splice(i, 1);
                }
            });
        }

        renderer.render(scene, camera);
    }

    // Iniciar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }

    window.Glass3D = { breakGlass, resetGlass, changeType: createGlass };
})();
